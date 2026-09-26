// scripts/demo-threshold-flip.ts
//
// The honest demo shot from ONCHAIN.md §8: a real Squads v4 multisig on
// devnet, created and controlled by us, whose threshold we lower live —
// and `keyholder::check` flips from pass to refused against the *exact
// same* on-chain accounts, no mocking. example_vault's `deposit` CPIs
// `check` (Enforce policy) and is accepted before the flip, refused after.
//
// Subcommands:
//   stage    create a 3-of-5 multisig (TIMELOCK_SECONDS time lock), hand the
//            demo target's upgrade authority to its vault, init keyholder
//            config / target / policies / example vault (all idempotent),
//            run check BEFORE + a real deposit, then create + approve (3 of 5)
//            the config transaction "threshold 2, time lock 0". Member keys
//            are saved (mode 600) to ~/.config/keyholder/demo-<multisig>.json.
//            Prints the DEMO_MULTISIG to pass to `execute`.
//   execute  DEMO_MULTISIG=<pda> required. Waits out the time lock, executes
//            the config transaction, verifies the multisig on chain, refresh,
//            then check AFTER (Enforce refuses, Report returns the reasons) and
//            a deposit that is refused.
//   all      (default) stage then execute in one run.
//
// A real 24 h run: `TIMELOCK_SECONDS=86400 npx tsx scripts/demo-threshold-flip.ts stage`
// today, then `DEMO_MULTISIG=<printed pda> npx tsx scripts/demo-threshold-flip.ts execute`
// tomorrow. Squads measures the time lock from the proposal's approval.
//
// Target: DEMO_TARGET_PROGRAM (required): any upgradeable program whose
// upgrade authority is the deployer, e.g. a fresh deploy of a no-op .so
// (~0.007 devnet SOL). `stage` hands its authority to the new vault.
// Never Keyholder's own program.
// `stage` needs the deployer to be the target's current upgrade authority;
// once handed to a vault, the target is reused only via that multisig's
// saved key file. Each fresh `stage` therefore needs a fresh target program.

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  clusterApiUrl,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as fs from "node:fs";
import { execSync } from "node:child_process";
import {
  KEYHOLDER_PROGRAM_ID,
  registerTargetIx,
  refreshIx,
  createPolicyIx,
  checkIx,
  configPda,
  attesterRegistryPda,
  controlStatePda,
  policyPda,
  programDataAddress,
  ixSighash,
  decodeCheckResult,
  squadsVaultPda,
  type PolicyParams,
} from "@keyholder/sdk";

function fail(msg: string): never {
  throw new Error(msg);
}

const TIMELOCK_SECONDS = Number(process.env.TIMELOCK_SECONDS ?? 10);
const HOME = process.env.HOME ?? "";
const DEPLOYER_KEYPAIR_PATH = process.env.DEPLOYER_KEYPAIR ?? `${HOME}/.config/keyholder/devnet-deployer.json`;
const EXAMPLE_VAULT_ID = new PublicKey("4dj7Nu6j5sb9dzL1NRk4RRFJFXxSdt6bQzfboqZsXMNY");
const TARGET = new PublicKey(process.env.DEMO_TARGET_PROGRAM ?? fail("DEMO_TARGET_PROGRAM=<program id> is required"));
const REPORT_POLICY_ID = BigInt(process.env.REPORT_POLICY_ID ?? 0);
const ENFORCE_POLICY_ID = BigInt(process.env.ENFORCE_POLICY_ID ?? 1);
const GUARD_ERRORS = ["SingleKey", "ThresholdBelowPolicy", "TimelockBelowPolicy", "RecentlyWeakened", "RecentlyUpgraded",
  "ControlledMultisig", "UnknownAuthority", "AttestationStale", "RiskTooHigh", "NotVerified",
  "MultisigAccountMissing", "AccountMismatch", "RefreshTooOld"];

if (TARGET.equals(KEYHOLDER_PROGRAM_ID)) throw new Error("refusing to use Keyholder's own program as the demo target");

const connection = new Connection(process.env.RPC_URL ?? clusterApiUrl("devnet"), "confirmed");
const deployer = loadKeypair(DEPLOYER_KEYPAIR_PATH);

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf-8"))));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const keyFile = (ms: PublicKey) => `${HOME}/.config/keyholder/demo-${ms.toBase58()}.json`;
type TxErr = { InstructionError?: [number, { Custom?: number } | string] } | null;
const customCode = (err: TxErr) => {
  const inner = err?.InstructionError?.[1];
  return typeof inner === "object" ? inner.Custom : undefined;
};
const guardName = (code?: number) => (code !== undefined && code >= 6000 && code < 6000 + GUARD_ERRORS.length ? ` GuardError::${GUARD_ERRORS[code - 6000]} (${code})` : "");

/** Squads rpc helpers return right after send; wait for confirmation so the next step sees the new state. */
async function confirm(label: string, sig: string): Promise<string> {
  const bh = await connection.getLatestBlockhash();
  const res = await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  if (res.value.err) throw new Error(`${label} failed on chain: ${JSON.stringify(res.value.err)} (${sig})`);
  console.log(`${label}: ${sig}`);
  return sig;
}

async function send(label: string, ixs: TransactionInstruction[], signers: Keypair[] = [deployer]) {
  const sig = await sendAndConfirmTransaction(connection, new Transaction().add(...ixs), signers);
  console.log(`${label}: ${sig}`);
  return sig;
}

const exists = async (pk: PublicKey) => (await connection.getAccountInfo(pk)) !== null;

// ---------------------------------------------------------------- keyholder setup (idempotent)

async function ensureConfig() {
  const [config] = configPda();
  if (await exists(config)) return console.log("config: already initialised", config.toBase58());
  const staleness = Buffer.alloc(8);
  staleness.writeBigUInt64LE(9_000n); // max_attest_staleness_slots; unused by the demo policies
  const ix = new TransactionInstruction({
    programId: KEYHOLDER_PROGRAM_ID,
    keys: [
      { pubkey: deployer.publicKey, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: attesterRegistryPda()[0], isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([ixSighash("init_config"), staleness]),
  });
  await send("init_config (governance = deployer)", [ix]);
}

async function ensureTarget(ms: PublicKey) {
  const [control] = controlStatePda(TARGET);
  if (await exists(control)) return send("refresh (target already registered)", [refreshIx(TARGET, ms)]);
  return send("register_target", [registerTargetIx(deployer.publicKey, TARGET, ms)]);
}

function policyParams(mode: 0 | 1): PolicyParams {
  return {
    minThreshold: 3, minTimeLock: TIMELOCK_SECONDS, allowSingleKey: false,
    cooldownAfterWeakenSlots: 0n, cooldownAfterDeploySlots: 0n, maxRefreshAgeSlots: 0n,
    requireAttestedOk: false, maxRiskLevel: 3, requireVerifiedBuild: false,
    mode, policyUpdateTimelockSlots: 5n,
  };
}

async function ensurePolicy(id: bigint, mode: 0 | 1) {
  const [pda] = policyPda(deployer.publicKey, id);
  const info = await connection.getAccountInfo(pda);
  if (!info) {
    await send(`create_policy #${id} (${mode === 0 ? "Enforce" : "Report"})`, [createPolicyIx(deployer.publicKey, id, policyParams(mode))]);
    return;
  }
  // Policy layout: disc 8, owner 32, policy_id 8, version 1, bump 1, then PolicyParams fields; mode at +34.
  const o = 8 + 32 + 8 + 1 + 1;
  const d = info.data;
  const onChain = { minThreshold: d.readUInt16LE(o), minTimeLock: d.readUInt32LE(o + 2), mode: d.readUInt8(o + 34) };
  console.log(`policy #${id}: already exists`, onChain);
  if (onChain.mode !== mode) throw new Error(`policy #${id} has mode ${onChain.mode}, expected ${mode}; pick another id via env`);
}

// ---------------------------------------------------------------- example vault

const vaultPda = () => PublicKey.findProgramAddressSync([Buffer.from("vault"), deployer.publicKey.toBuffer()], EXAMPLE_VAULT_ID)[0];

async function ensureExampleVault() {
  if (await exists(vaultPda())) return console.log("example vault: already initialised", vaultPda().toBase58());
  await send("example_vault.init_vault", [new TransactionInstruction({
    programId: EXAMPLE_VAULT_ID,
    keys: [
      { pubkey: deployer.publicKey, isSigner: true, isWritable: true },
      { pubkey: vaultPda(), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixSighash("init_vault"),
  })]);
}

function depositIx(ms: PublicKey, amount: bigint) {
  const amt = Buffer.alloc(8);
  amt.writeBigUInt64LE(amount);
  const ro = (pubkey: PublicKey) => ({ pubkey, isSigner: false, isWritable: false });
  return new TransactionInstruction({
    programId: EXAMPLE_VAULT_ID,
    keys: [
      { pubkey: deployer.publicKey, isSigner: true, isWritable: true },
      { pubkey: vaultPda(), isSigner: false, isWritable: true },
      ro(policyPda(deployer.publicKey, ENFORCE_POLICY_ID)[0]), ro(configPda()[0]), ro(controlStatePda(TARGET)[0]),
      ro(TARGET), ro(programDataAddress(TARGET)[0]), ro(ms), ro(KEYHOLDER_PROGRAM_ID),
    ],
    data: Buffer.concat([ixSighash("deposit"), amt]),
  });
}

/** Sends the deposit for real (skipPreflight, so a refusal also lands on chain with a signature). */
async function deposit(label: string, ms: PublicKey) {
  const sig = await connection.sendTransaction(new Transaction().add(depositIx(ms, 1_000n)), [deployer], { skipPreflight: true });
  let status = null;
  for (let i = 0; i < 60 && !status?.confirmationStatus; i++) {
    await sleep(1000);
    status = (await connection.getSignatureStatuses([sig])).value[0];
  }
  if (!status) throw new Error(`deposit ${sig} not confirmed`);
  const err = status.err as TxErr;
  console.log(`${label}: ${err ? `REFUSED ${JSON.stringify(err)}${guardName(customCode(err))}` : "ACCEPTED"} sig=${sig}`);
}

// ---------------------------------------------------------------- check

async function simulateCheck(label: string, policyId: bigint, ms: PublicKey) {
  const ix = checkIx(policyPda(deployer.publicKey, policyId)[0], TARGET, ms);
  const sim = await connection.simulateTransaction(new Transaction().add(ix), [deployer]);
  const rd = sim.value.returnData;
  const decoded = rd ? decodeCheckResult(Buffer.from(rd.data[0], "base64")) : null;
  const err = sim.value.err as TxErr;
  const errText = err ? ` err=${JSON.stringify(err)}${guardName(customCode(err))}` : "";
  const res = decoded
    ? `ok=${decoded.ok} reasons=0b${decoded.reasons.toString(2)} [${decoded.reasonMessages.join("; ") || "none"}] threshold=${decoded.threshold} time_lock=${decoded.timeLock} score=${decoded.derivedScore}`
    : "no return data";
  console.log(`${label} policy#${policyId}: ${res}${errText}`);
  if (err) console.log(sim.value.logs?.filter((l) => l.includes("Error")).join("\n"));
}

// ---------------------------------------------------------------- stage / execute

interface DemoKeys { multisig: string; transactionIndex: string; members: number[][]; timeLock: number }

async function stage(): Promise<PublicKey> {
  console.log("deployer:", deployer.publicKey.toBase58(), " target:", TARGET.toBase58());
  const members = [deployer, Keypair.generate(), Keypair.generate(), Keypair.generate(), Keypair.generate()];
  const createKey = Keypair.generate();
  const [ms] = multisig.getMultisigPda({ createKey: createKey.publicKey });
  const [vault] = squadsVaultPda(ms, 0);
  // Persist member keys before anything irreversible, so `execute` (and any recovery) can sign.
  const saved: DemoKeys = { multisig: ms.toBase58(), transactionIndex: "0", members: members.slice(1).map((k) => Array.from(k.secretKey)), timeLock: TIMELOCK_SECONDS };
  fs.writeFileSync(keyFile(ms), JSON.stringify(saved), { mode: 0o600 });

  console.log(`\n== Squads v4 multisig: 3-of-5, ${TIMELOCK_SECONDS}s time lock ==`);
  const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(connection, multisig.getProgramConfigPda({})[0]);
  const all = multisig.types.Permissions.all();
  const vote = multisig.types.Permissions.fromPermissions([multisig.types.Permission.Vote]);
  await confirm("multisigCreateV2", await multisig.rpc.multisigCreateV2({
    connection, treasury: programConfig.treasury, createKey, creator: deployer, multisigPda: ms,
    configAuthority: null, timeLock: TIMELOCK_SECONDS, threshold: 3, rentCollector: null,
    members: members.map((k, i) => ({ key: k.publicKey, permissions: i < 3 ? all : vote })),
  }));
  console.log("multisig:", ms.toBase58(), " vault:", vault.toBase58());

  console.log("\n== demo target upgrade authority -> vault ==");
  execSync(`solana program set-upgrade-authority ${TARGET.toBase58()} --new-upgrade-authority ${vault.toBase58()} ` +
    `--skip-new-upgrade-authority-signer-check --keypair ${DEPLOYER_KEYPAIR_PATH} --url devnet`, { stdio: "inherit" });

  console.log("\n== keyholder + example vault setup (idempotent) ==");
  await ensureConfig();
  await ensureTarget(ms);
  await ensurePolicy(REPORT_POLICY_ID, 1);
  await ensurePolicy(ENFORCE_POLICY_ID, 0);
  await ensureExampleVault();

  console.log(`\n== BEFORE (3-of-5, ${TIMELOCK_SECONDS}s): expect PASS ==`);
  await simulateCheck("check BEFORE (Report)", REPORT_POLICY_ID, ms);
  await simulateCheck("check BEFORE (Enforce)", ENFORCE_POLICY_ID, ms);
  await deposit("example_vault.deposit BEFORE", ms);

  console.log("\n== config transaction: threshold 3 -> 2, time lock -> 0 ==");
  const msAcc = await multisig.accounts.Multisig.fromAccountAddress(connection, ms);
  const transactionIndex = BigInt(msAcc.transactionIndex.toString()) + 1n;
  await confirm(`configTransactionCreate (index ${transactionIndex})`, await multisig.rpc.configTransactionCreate({
    connection, feePayer: deployer, multisigPda: ms, transactionIndex, creator: deployer.publicKey,
    actions: [{ __kind: "ChangeThreshold", newThreshold: 2 }, { __kind: "SetTimeLock", newTimeLock: 0 }],
  }));
  await confirm("proposalCreate", await multisig.rpc.proposalCreate({ connection, feePayer: deployer, creator: deployer, multisigPda: ms, transactionIndex }));
  for (const [i, m] of members.slice(0, 3).entries()) {
    await confirm(`proposalApprove member ${i + 1}/5`, await multisig.rpc.proposalApprove({ connection, feePayer: deployer, member: m, multisigPda: ms, transactionIndex }));
  }
  fs.writeFileSync(keyFile(ms), JSON.stringify({ ...saved, transactionIndex: transactionIndex.toString() }), { mode: 0o600 });
  console.log(`\nSTAGED. Execute after the time lock with: DEMO_MULTISIG=${ms.toBase58()} npx tsx scripts/demo-threshold-flip.ts execute`);
  return ms;
}

async function waitForTimeLock(ms: PublicKey, transactionIndex: bigint, timeLock: number) {
  const [proposalPda] = multisig.getProposalPda({ multisigPda: ms, transactionIndex });
  const proposal = await multisig.accounts.Proposal.fromAccountAddress(connection, proposalPda);
  if (proposal.status.__kind !== "Approved") throw new Error(`proposal status is ${proposal.status.__kind}, not Approved`);
  const unlockAt = Number(proposal.status.timestamp.toString()) + timeLock;
  const now = (await connection.getBlockTime(await connection.getSlot())) ?? Math.floor(Date.now() / 1000);
  const waitS = Math.max(0, unlockAt - now) + 3;
  console.log(`time lock: approved at ${proposal.status.timestamp.toString()}, unlocks at ${unlockAt}; waiting ${waitS}s`);
  await sleep(waitS * 1000);
}

async function execute(ms: PublicKey) {
  const keys: DemoKeys = JSON.parse(fs.readFileSync(keyFile(ms), "utf-8"));
  const transactionIndex = BigInt(keys.transactionIndex);
  if (transactionIndex === 0n) throw new Error("no staged config transaction recorded for this multisig");
  await waitForTimeLock(ms, transactionIndex, keys.timeLock);

  console.log("\n== THE FLIP ==");
  await confirm("configTransactionExecute", await multisig.rpc.configTransactionExecute({
    connection, feePayer: deployer, multisigPda: ms, transactionIndex, member: deployer, rentPayer: deployer,
  }));
  const after = await multisig.accounts.Multisig.fromAccountAddress(connection, ms);
  console.log(`multisig re-read from chain: threshold=${after.threshold} time_lock=${after.timeLock}`);
  if (after.threshold !== 2 || after.timeLock !== 0) throw new Error("config transaction did not apply");

  await send("refresh", [refreshIx(TARGET, ms)]);
  console.log("\n== AFTER (2-of-5, 0s): expect REFUSED ==");
  await simulateCheck("check AFTER (Enforce)", ENFORCE_POLICY_ID, ms);
  await simulateCheck("check AFTER (Report/Simulate)", REPORT_POLICY_ID, ms);
  await deposit("example_vault.deposit AFTER", ms);
}

async function main() {
  const cmd = process.argv[2] ?? "all";
  if (cmd === "stage") return void (await stage());
  if (cmd === "execute") {
    if (!process.env.DEMO_MULTISIG) throw new Error("execute needs DEMO_MULTISIG=<multisig pda>");
    return execute(new PublicKey(process.env.DEMO_MULTISIG));
  }
  if (cmd === "all") return execute(await stage());
  throw new Error(`unknown subcommand ${cmd} (stage | execute | all)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
