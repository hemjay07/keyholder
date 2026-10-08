// File: apps/worker/src/records/pending.ts
// Pending control actions (design/REVAMP-3.md, LLM features): for a Squads v4 multisig that controls a
// covered program, every proposal not yet executed, cancelled or rejected, the transaction it would run,
// and what each action in it does. Decoded with Squads' own on-chain IDL; nothing is inferred from names.
// Drift's March 2026 takeover sat as pending multisig transactions before it executed.

import { Connection, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { createHash } from 'node:crypto';
import { decodeAnchorAccount, parseSquadsV4Multisig, type AnchorIdl } from '@keyholder/decoder';

export const SQUADS_V4 = new PublicKey('SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf');
const LOADER = 'BPFLoaderUpgradeab1e11111111111111111111111';
const TOKEN = new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const SYSTEM = '11111111111111111111111111111111';
const OPEN = new Set(['Draft', 'Active', 'Approved']);

const disc = (name: string) => createHash('sha256').update(`account:${name}`).digest().subarray(0, 8);

export type Action =
  | { type: 'program_upgrade'; program: string | null; buffer: string | null }
  | { type: 'set_upgrade_authority'; programData: string | null; newAuthority: string | null }
  | { type: 'close_program'; account: string | null }
  | { type: 'token_transfer'; source: string | null; destination: string | null; amountRaw: string | null }
  | { type: 'sol_transfer'; to: string | null; lamports: string | null }
  | { type: 'add_member'; key: string }
  | { type: 'remove_member'; key: string }
  | { type: 'change_threshold'; to: number }
  | { type: 'set_timelock'; seconds: number }
  | { type: 'other_config'; action: string }
  | { type: 'call'; program: string; dataHex: string };

export interface PendingTx {
  multisig: string; index: string; address: string; kind: 'vault' | 'config';
  status: string; statusAt: number | null; approvals: string[]; rejections: string[];
  creator: string; actions: Action[];
}

/** Address of the transaction account a proposal votes on: seeds ["multisig", ms, "transaction", index u64 LE]. */
export function transactionPda(multisig: string, index: bigint): string {
  const i = Buffer.alloc(8); i.writeBigUInt64LE(index);
  return PublicKey.findProgramAddressSync([Buffer.from('multisig'), new PublicKey(multisig).toBuffer(), Buffer.from('transaction'), i], SQUADS_V4)[0].toBase58();
}

const key = (v: unknown): string => (typeof v === 'string' ? v : new PublicKey(v as Uint8Array).toBase58());
const bytes = (v: unknown): Buffer => Buffer.from(v as number[]);

/** What one inner instruction of a vault transaction does. */
export function classifyInstruction(programId: string, data: Buffer, accounts: string[]): Action {
  const tag = data.length >= 4 ? data.readUInt32LE(0) : -1;
  if (programId === LOADER && tag === 3) return { type: 'program_upgrade', program: accounts[1] ?? null, buffer: accounts[2] ?? null };
  if (programId === LOADER && (tag === 4 || tag === 7)) return { type: 'set_upgrade_authority', programData: accounts[0] ?? null, newAuthority: accounts[2] ?? null };
  if (programId === LOADER && tag === 5) return { type: 'close_program', account: accounts[0] ?? null };
  if (TOKEN.has(programId) && (data[0] === 3 || data[0] === 12)) {
    const amount = data.length >= 9 ? data.readBigUInt64LE(1).toString() : null;
    return { type: 'token_transfer', source: accounts[0] ?? null, destination: data[0] === 12 ? accounts[2] ?? null : accounts[1] ?? null, amountRaw: amount };
  }
  if (programId === SYSTEM && tag === 2) return { type: 'sol_transfer', to: accounts[1] ?? null, lamports: data.length >= 12 ? data.readBigUInt64LE(4).toString() : null };
  return { type: 'call', program: programId, dataHex: data.subarray(0, 16).toString('hex') };
}

/** The actions in a decoded VaultTransaction message. */
export function vaultActions(message: Record<string, unknown>): Action[] {
  const keys = (message.accountKeys as unknown[]).map(key);
  return (message.instructions as Record<string, unknown>[]).map((ix) => {
    const programId = keys[Number(ix.programIdIndex)] ?? 'unknown';
    // Array.from: the decoder returns u8 vectors as Uint8Array, whose .map would coerce strings back to numbers.
    const accounts = Array.from(ix.accountIndexes as ArrayLike<number>, (i) => keys[i] ?? 'lookup-table account');
    return classifyInstruction(programId, bytes(ix.data), accounts);
  });
}

/** The actions in a decoded ConfigTransaction. */
export function configActions(actions: Record<string, unknown>[]): Action[] {
  return actions.map((a) => {
    const variant = String(a.variant);
    const f = (a.fields ?? {}) as Record<string, unknown>;
    if (variant === 'AddMember') return { type: 'add_member', key: key((f.newMember as Record<string, unknown>).key) };
    if (variant === 'RemoveMember') return { type: 'remove_member', key: key(f.oldMember) };
    if (variant === 'ChangeThreshold') return { type: 'change_threshold', to: Number(f.newThreshold) };
    if (variant === 'SetTimeLock') return { type: 'set_timelock', seconds: Number(f.newTimeLock) };
    return { type: 'other_config', action: variant };
  });
}

/** Every open proposal of one multisig, with its decoded transaction. */
export async function pendingFor(conn: Connection, idl: AnchorIdl, multisig: string): Promise<PendingTx[]> {
  const proposals = await conn.getProgramAccounts(SQUADS_V4, { filters: [{ memcmp: { offset: 0, bytes: bs58.encode(disc('Proposal')) } }, { memcmp: { offset: 8, bytes: multisig } }] });
  // Proposals at or below the multisig's stale_transaction_index can never execute (Squads invalidates them on config changes).
  const msAcc = await conn.getAccountInfo(new PublicKey(multisig));
  const stale = msAcc ? BigInt(String(parseSquadsV4Multisig(msAcc.data).staleTransactionIndex)) : 0n;
  const out: PendingTx[] = [];
  for (const p of proposals) {
    const prop = decodeAnchorAccount(idl, 'Proposal', p.account.data);
    const status = prop.status as { variant: string; fields?: Record<string, unknown> };
    if (!OPEN.has(status.variant)) continue;
    const index = BigInt(String(prop.transactionIndex));
    if (index <= stale) continue;
    const address = transactionPda(multisig, index);
    const acc = await conn.getAccountInfo(new PublicKey(address));
    if (!acc) continue;
    const isVault = acc.data.subarray(0, 8).equals(disc('VaultTransaction'));
    const tx = decodeAnchorAccount(idl, isVault ? 'VaultTransaction' : 'ConfigTransaction', acc.data);
    out.push({
      multisig, index: index.toString(), address, kind: isVault ? 'vault' : 'config',
      status: status.variant, statusAt: status.fields?.timestamp != null ? Number(String(status.fields.timestamp)) : null,
      approvals: (prop.approved as unknown[]).map(key), rejections: (prop.rejected as unknown[]).map(key), creator: key(tx.creator),
      actions: isVault ? vaultActions(tx.message as Record<string, unknown>) : configActions(tx.actions as Record<string, unknown>[]),
    });
  }
  return out.sort((a, b) => (BigInt(a.index) < BigInt(b.index) ? -1 : 1));
}

/** True when any action changes who controls a program or moves funds (worth an alert and an explanation). */
export const controlRelevant = (t: PendingTx) => t.actions.some((a) => a.type !== 'call' && a.type !== 'other_config');
