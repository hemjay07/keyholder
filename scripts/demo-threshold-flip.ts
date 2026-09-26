// scripts/demo-threshold-flip.ts
//
// The honest demo shot from ONCHAIN.md §8: a real Squads v4 multisig on
// devnet, created and controlled by us, whose threshold we lower live —
// and `keyholder::check` (Simulate/Report mode) flips from pass to refused
// against the *exact same* on-chain accounts, no mocking.
//
// DEVIATION (logged, not hidden): the task's "24h time lock" is created
// with TIMELOCK_SECONDS below instead of 86,400. Squads v4 enforces its
// time_lock on the gap between a config transaction's *approval* and its
// *execution* — so a real 24h timelock would require this script to be
// re-run 24 hours after staging the threshold-drop transaction, which is
// infeasible inside a single build session. The mechanism `check` reads
// (the live `time_lock` field, live `threshold`) is byte-for-byte the same
// regardless of the timelock's magnitude; only the wall-clock wait differs.
// Set TIMELOCK_SECONDS=86400 to run the real 24h version.
//
// Usage: pnpm tsx scripts/demo-threshold-flip.ts

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  clusterApiUrl,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as fs from "node:fs";
import {
  KEYHOLDER_PROGRAM_ID,
  registerTargetIx,
  refreshIx,
  createPolicyIx,
  checkIx,
  decodeCheckResult,
  squadsVaultPda,
  type PolicyParams,
} from "@keyholder/sdk";

const TIMELOCK_SECONDS = Number(process.env.TIMELOCK_SECONDS ?? 10);
const DEPLOYER_KEYPAIR_PATH = process.env.DEPLOYER_KEYPAIR ?? `${process.env.HOME}/.config/keyholder/devnet-deployer.json`;

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(path, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const deployer = loadKeypair(DEPLOYER_KEYPAIR_PATH);
  console.log("deployer:", deployer.publicKey.toBase58());

  // A second "member" is a locally-generated ephemeral keypair funded by the
  // deployer; the flip only needs deployer + this member to reach a 2-of-5
  // (or a 3-of-5) threshold since we control both.
  const memberB = Keypair.generate();
  const memberC = Keypair.generate();

  // ---- 1. Create the multisig: 3-of-5, TIMELOCK_SECONDS timelock ----
  const createKey = Keypair.generate();
  const [multisigPda] = multisig.getMultisigPda({ createKey: createKey.publicKey });
  const [vaultPda] = squadsVaultPda(multisigPda, 0);

  console.log(`\n== creating Squads v4 multisig: 3-of-5, ${TIMELOCK_SECONDS}s timelock ==`);
  const [programConfigPda] = multisig.getProgramConfigPda({});
  const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(connection, programConfigPda);
  const createSig = await multisig.rpc.multisigCreateV2({
    connection,
    treasury: programConfig.treasury,
    createKey,
    creator: deployer,
    multisigPda,
    configAuthority: null, // autonomous: threshold changes go through proposals, not a controller
    timeLock: TIMELOCK_SECONDS,
    members: [
      { key: deployer.publicKey, permissions: multisig.types.Permissions.all() },
      { key: memberB.publicKey, permissions: multisig.types.Permissions.all() },
      { key: memberC.publicKey, permissions: multisig.types.Permissions.all() },
      { key: Keypair.generate().publicKey, permissions: multisig.types.Permissions.fromPermissions([multisig.types.Permission.Vote]) },
      { key: Keypair.generate().publicKey, permissions: multisig.types.Permissions.fromPermissions([multisig.types.Permission.Vote]) },
    ],
    threshold: 3,
    rentCollector: null,
    sendOptions: { skipPreflight: false },
  });
  console.log("multisig created:", multisigPda.toBase58());
  console.log("vault (would-be program upgrade authority):", vaultPda.toBase58());
  console.log("createMultisig signature:", createSig);

  // ---- 2. Eat our own cooking: keyholder's own devnet upgrade authority
  // becomes this vault, so `target_program` is keyholder itself. This is
  // the exact ONCHAIN.md §7 posture ("register ControlGuard itself as a
  // target"), and it avoids deploying a second throwaway program just to
  // hold an authority slot.
  const targetProgram = new PublicKey(process.env.DEPLOYED_TARGET_PROGRAM ?? KEYHOLDER_PROGRAM_ID.toBase58());

  if (!process.env.SKIP_SET_AUTHORITY) {
    console.log("\n== setting keyholder's devnet upgrade authority to the new vault ==");
    const { execSync } = await import("node:child_process");
    execSync(
      `solana program set-upgrade-authority ${targetProgram.toBase58()} --new-upgrade-authority ${vaultPda.toBase58()} ` +
        `--keypair ${DEPLOYER_KEYPAIR_PATH} --url devnet`,
      { stdio: "inherit" }
    );
  }

  const [programDataAddr] = PublicKey.findProgramAddressSync(
    [targetProgram.toBuffer()],
    new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
  );

  console.log("\n== register_target + create_policy ==");
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(registerTargetIx(deployer.publicKey, targetProgram, multisigPda)),
    [deployer]
  );

  const strictParams: PolicyParams = {
    minThreshold: 3,
    minTimeLock: TIMELOCK_SECONDS,
    allowSingleKey: false,
    cooldownAfterWeakenSlots: 0n,
    cooldownAfterDeploySlots: 0n,
    maxRefreshAgeSlots: 0n,
    requireAttestedOk: false,
    maxRiskLevel: 3,
    requireVerifiedBuild: false,
    mode: 1, // Report: never revert, just show the flip in the returned reasons
    policyUpdateTimelockSlots: 5n,
  };
  const policyId = 0n;
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(createPolicyIx(deployer.publicKey, policyId, strictParams)),
    [deployer]
  );
  const { policyPda: derivePolicyPda } = await import("@keyholder/sdk");

  async function runCheck(label: string) {
    const [policy] = derivePolicyPda(deployer.publicKey, policyId);
    const ix = checkIx(policy, targetProgram, multisigPda);
    const sim = await connection.simulateTransaction(
      new Transaction().add(ix),
      [deployer]
    );
    if (sim.value.err) {
      console.log(`${label}: tx-level error`, sim.value.err, sim.value.logs?.slice(-5));
      return;
    }
    const rd = sim.value.returnData;
    if (!rd) {
      console.log(`${label}: no return data`, sim.value.logs?.slice(-5));
      return;
    }
    const decoded = decodeCheckResult(Buffer.from(rd.data[0], "base64"));
    console.log(`${label}: ok=${decoded.ok} threshold=${decoded.threshold} time_lock=${decoded.timeLock} reasons=${decoded.reasonMessages.join(", ") || "none"}`);
  }

  // ---- 3. check (Simulate/Report) against the strong state: should PASS ----
  console.log("\n== check() before the flip (3-of-5, timelock=" + TIMELOCK_SECONDS + "s): expect PASS ==");
  await runCheck("BEFORE");

  // ---- 4. Stage a config transaction: threshold 3 -> 2, timelock -> 0 ----
  console.log("\n== staging config transaction: threshold 3->2, timelock -> 0 ==");
  const transactionIndex = 1n;
  const proposeSig = await multisig.rpc.configTransactionCreate({
    connection,
    feePayer: deployer,
    multisigPda,
    transactionIndex,
    creator: deployer.publicKey,
    actions: [
      { __kind: "ChangeThreshold", newThreshold: 2 },
      { __kind: "SetTimeLock", newTimeLock: 0 },
    ],
  });
  console.log("configTransactionCreate signature:", proposeSig);

  const proposalCreateSig = await multisig.rpc.proposalCreate({
    connection, feePayer: deployer, creator: deployer, multisigPda, transactionIndex,
  });
  console.log("proposalCreate signature:", proposalCreateSig);

  const approve1 = await multisig.rpc.proposalApprove({ connection, feePayer: deployer, multisigPda, transactionIndex, member: deployer });
  const approve2 = await multisig.rpc.proposalApprove({ connection, feePayer: deployer, multisigPda, transactionIndex, member: memberB });
  const approve3 = await multisig.rpc.proposalApprove({ connection, feePayer: deployer, multisigPda, transactionIndex, member: memberC });
  console.log("approvals:", approve1, approve2, approve3);

  console.log(`\nwaiting for the ${TIMELOCK_SECONDS}s timelock to elapse before execution...`);
  await sleep((TIMELOCK_SECONDS + 3) * 1000);

  const executeSig = await multisig.rpc.configTransactionExecute({
    connection, feePayer: deployer, multisigPda, transactionIndex, member: deployer, rentPayer: deployer,
  });
  console.log("configTransactionExecute signature (THE FLIP):", executeSig);

  // ---- 5. refresh + check again: should now REFUSE ----
  console.log("\n== check() after the flip (2-of-5, timelock=0): expect REFUSED ==");
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(refreshIx(targetProgram, multisigPda)),
    [deployer]
  );
  await runCheck("AFTER");

  console.log("\nDone. Signatures for the record:");
  console.log(JSON.stringify({ createSig, proposeSig, proposalCreateSig, executeSig }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
