// scripts/own-upgrade.ts
// Upgrade Keyholder's own devnet program through its own 2-of-3 Squads v4 multisig with a 48 h timelock
// (data/own-multisig.json): the program upgrades itself under the rule it enforces.
//
//   BUFFER=<buffer> npx tsx scripts/own-upgrade.ts stage    vault transaction (loader Upgrade) + proposal + 2 approvals
//   npx tsx scripts/own-upgrade.ts status                   proposal state and when the timelock ends
//   npx tsx scripts/own-upgrade.ts execute                  after the timelock: execute, then verify on chain
//
// The buffer must already exist with its authority set to the vault (solana program write-buffer, then
// set-buffer-authority). Member keys are read from ~/.config/keyholder/own-member-{1,2,3}.json (mode 600, never printed).
// State (transaction index, signatures) is appended to data/own-upgrade.json for the /proof page.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Connection, Keypair, PublicKey, SYSVAR_CLOCK_PUBKEY, SYSVAR_RENT_PUBKEY, TransactionInstruction, TransactionMessage } from '@solana/web3.js';
import * as multisig from '@sqds/multisig';

const own = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'own-multisig.json'), 'utf8')) as { program: string; multisig: string; vault: string; timeLockSeconds: number };
const STATE = join(__dirname, '..', 'data', 'own-upgrade.json');
const LOADER = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
const kp = (p: string) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(p, 'utf8'))));
const deployer = kp(join(homedir(), '.config', 'solana', 'id.json'));
const member = (i: number) => kp(join(homedir(), '.config', 'keyholder', `own-member-${i}.json`));
const ms = new PublicKey(own.multisig);
const vault = new PublicKey(own.vault);
const program = new PublicKey(own.program);
const state = (): Record<string, unknown> => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {});
const save = (s: Record<string, unknown>) => writeFileSync(STATE, JSON.stringify(s, null, 1));

async function confirm(label: string, sig: string): Promise<string> {
  await conn.confirmTransaction(sig, 'confirmed');
  console.log(`${label}: ${sig}`);
  return sig;
}

function upgradeIx(buffer: PublicKey): TransactionInstruction {
  const [programData] = PublicKey.findProgramAddressSync([program.toBuffer()], LOADER);
  const data = Buffer.alloc(4); data.writeUInt32LE(3); // UpgradeableLoaderInstruction::Upgrade
  return new TransactionInstruction({
    programId: LOADER,
    keys: [
      { pubkey: programData, isSigner: false, isWritable: true },
      { pubkey: program, isSigner: false, isWritable: true },
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true }, // spill: buffer rent returns to the vault
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: true, isWritable: false },
    ],
    data,
  });
}

async function stage(): Promise<void> {
  const buffer = new PublicKey(process.env.BUFFER ?? '');
  const ms0 = await multisig.accounts.Multisig.fromAccountAddress(conn, ms);
  const transactionIndex = BigInt(ms0.transactionIndex.toString()) + 1n;
  const { blockhash } = await conn.getLatestBlockhash();
  const message = new TransactionMessage({ payerKey: vault, recentBlockhash: blockhash, instructions: [upgradeIx(buffer)] });
  const m1 = member(1), m2 = member(2);
  const created = await confirm('vaultTransactionCreate', await multisig.rpc.vaultTransactionCreate({ connection: conn, feePayer: deployer, multisigPda: ms, transactionIndex, creator: m1.publicKey, vaultIndex: 0, ephemeralSigners: 0, transactionMessage: message, signers: [m1] } as never));
  const proposed = await confirm('proposalCreate', await multisig.rpc.proposalCreate({ connection: conn, feePayer: deployer, creator: m1, multisigPda: ms, transactionIndex }));
  const a1 = await confirm('approve member 1', await multisig.rpc.proposalApprove({ connection: conn, feePayer: deployer, member: m1, multisigPda: ms, transactionIndex }));
  const a2 = await confirm('approve member 2', await multisig.rpc.proposalApprove({ connection: conn, feePayer: deployer, member: m2, multisigPda: ms, transactionIndex }));
  save({ ...state(), upgrade: { buffer: buffer.toBase58(), transactionIndex: transactionIndex.toString(), created, proposed, approvals: [a1, a2], approvedAt: new Date().toISOString(), executableAfter: new Date(Date.now() + own.timeLockSeconds * 1000).toISOString() } });
  console.log(`approved 2 of 3; executable after ${own.timeLockSeconds} s (${new Date(Date.now() + own.timeLockSeconds * 1000).toISOString()})`);
}

async function status(): Promise<void> {
  const s = state().upgrade as { transactionIndex: string } | undefined;
  if (!s) throw new Error('nothing staged');
  const [proposal] = multisig.getProposalPda({ multisigPda: ms, transactionIndex: BigInt(s.transactionIndex) });
  const p = await multisig.accounts.Proposal.fromAccountAddress(conn, proposal);
  console.log(JSON.stringify({ ...s, status: p.status.__kind, approved: p.approved.map((k) => k.toBase58()) }, null, 1));
}

async function execute(): Promise<void> {
  const s = state().upgrade as { transactionIndex: string } | undefined;
  if (!s) throw new Error('nothing staged');
  const sig = await confirm('vaultTransactionExecute', await multisig.rpc.vaultTransactionExecute({ connection: conn, feePayer: deployer, multisigPda: ms, transactionIndex: BigInt(s.transactionIndex), member: member(1).publicKey, signers: [member(1)] } as never));
  const [programData] = PublicKey.findProgramAddressSync([program.toBuffer()], LOADER);
  const pd = await conn.getAccountInfo(programData);
  const slot = pd ? Number(pd.data.readBigUInt64LE(4)) : null;
  save({ ...state(), upgrade: { ...s, executed: sig, executedAt: new Date().toISOString(), programDataSlot: slot } });
  console.log(`upgraded; programdata last deploy slot ${slot}`);
}

const cmd = process.argv[2];
(cmd === 'stage' ? stage() : cmd === 'status' ? status() : cmd === 'execute' ? execute() : Promise.reject(new Error('usage: own-upgrade.ts stage|status|execute'))).catch((e) => { console.error(e instanceof Error ? e.message : e); if (e?.logs) console.error(e.logs.join('\n')); process.exit(1); });
