// scripts/own-multisig.ts
// Puts Keyholder's own devnet program under a 2-of-3 Squads v4 multisig with
// a 48-hour timelock (founder, 2026-09-27: "all 3 mine"). Member keys are
// generated here and written to ~/.config/keyholder/own-member-{1,2,3}.json
// (mode 600); they are never printed. Public addresses and the transaction
// signatures go to data/own-multisig.json for the /proof page.
//
//   npx tsx scripts/own-multisig.ts
//
// Irreversible without the multisig: after this, upgrading the program needs
// 2 of the 3 member keys and a 48-hour wait.

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execSync } from "node:child_process";

const RPC = "https://api.devnet.solana.com";
const PROGRAM = new PublicKey("3FX57MQmZH8dkpFV5nbA1XWyV6WDeinu7ennZhvx8R8F");
const DIR = path.join(os.homedir(), ".config", "keyholder");
const DEPLOYER = path.join(DIR, "devnet-deployer.json");
const TIMELOCK_S = 48 * 3600;
const RECORD = path.join(__dirname, "..", "data", "own-multisig.json");

function loadOrCreate(file: string): Keypair {
  if (fs.existsSync(file)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
  const kp = Keypair.generate();
  fs.writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  return kp;
}

async function main(): Promise<void> {
  if (fs.existsSync(RECORD)) {
    console.log("already done:", RECORD);
    return;
  }
  const connection = new Connection(RPC, "confirmed");
  const deployer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(DEPLOYER, "utf8"))));
  const members = [1, 2, 3].map((i) => loadOrCreate(path.join(DIR, `own-member-${i}.json`)));

  const createKey = Keypair.generate();
  const [ms] = multisig.getMultisigPda({ createKey: createKey.publicKey });
  const [vault] = multisig.getVaultPda({ multisigPda: ms, index: 0 });
  const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(connection, multisig.getProgramConfigPda({})[0]);

  const createSig = await multisig.rpc.multisigCreateV2({
    connection,
    treasury: programConfig.treasury,
    createKey,
    creator: deployer,
    multisigPda: ms,
    configAuthority: null,
    timeLock: TIMELOCK_S,
    threshold: 2,
    rentCollector: null,
    members: members.map((k) => ({ key: k.publicKey, permissions: multisig.types.Permissions.all() })),
  });
  await connection.confirmTransaction(createSig, "confirmed");

  const read = await multisig.accounts.Multisig.fromAccountAddress(connection, ms);
  if (read.threshold !== 2 || read.timeLock !== TIMELOCK_S || read.members.length !== 3) {
    throw new Error(`multisig reads back wrong: ${read.threshold}/${read.members.length}, ${read.timeLock}s`);
  }

  const out = execSync(
    `solana program set-upgrade-authority ${PROGRAM.toBase58()} --new-upgrade-authority ${vault.toBase58()} ` +
      `--skip-new-upgrade-authority-signer-check --upgrade-authority ${DEPLOYER} --keypair ${DEPLOYER} --url devnet`,
    { encoding: "utf8" }
  );
  const setSig = out.match(/Signature: (\w+)/)?.[1] ?? null;

  const record = {
    cluster: "devnet",
    program: PROGRAM.toBase58(),
    multisig: ms.toBase58(),
    vault: vault.toBase58(),
    threshold: 2,
    members: members.map((m) => m.publicKey.toBase58()),
    timeLockSeconds: TIMELOCK_S,
    configAuthority: null,
    createSignature: createSig,
    setAuthoritySignature: setSig,
    at: new Date().toISOString(),
  };
  fs.writeFileSync(RECORD, JSON.stringify(record, null, 2) + "\n");
  console.log(JSON.stringify({ multisig: record.multisig, vault: record.vault, createSignature: createSig, setAuthoritySignature: setSig }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
