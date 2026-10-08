// File: apps/worker/src/coverage/anchor.ts
// The observation log made provable (design/MOAT-BUILD.md, C): a sha256 over one day's
// program_daily rows in canonical form, written to chain as a memo. Anyone holding the rows
// can recompute the hash and compare it with the memo, whose slot proves when it existed.

import { createHash } from 'node:crypto';
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';

export const MEMO_PROGRAM_ID = new PublicKey('Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo');

export interface DailyRow {
  day: string; program_id: string; slot: number; upgrade_authority: string | null;
  authority_kind: string; multisig: string | null; threshold: number | null; members: string[] | null;
  /** v2 fields (2026-10-08). Absent or null on rows written before. */
  timelock_s?: number | null; ms_version?: string | null;
}

/** Canonical forms are versioned so a day anchored under one form always verifies under it.
 *  v1: 2026-10-04 .. 2026-10-08. v2 adds timelock_s and ms_version. */
export type CanonicalVersion = 'v1' | 'v2';
export const CURRENT_CANONICAL: CanonicalVersion = 'v2';

function fields(r: DailyRow, v: CanonicalVersion): unknown[] {
  const base = [r.day, r.program_id, Number(r.slot), r.upgrade_authority, r.authority_kind, r.multisig, r.threshold, r.members ? [...r.members].sort() : null];
  return v === 'v1' ? base : [...base, r.timelock_s ?? null, r.ms_version ?? null];
}

/** One line per program, sorted by program id, fixed field order; checked_at is excluded (not observed state). */
export function canonical(rows: DailyRow[], v: CanonicalVersion = CURRENT_CANONICAL): string {
  return [...rows]
    .sort((a, b) => (a.program_id < b.program_id ? -1 : a.program_id > b.program_id ? 1 : 0))
    .map((r) => JSON.stringify(fields(r, v)))
    .join('\n');
}

export function digest(rows: DailyRow[], v: CanonicalVersion = CURRENT_CANONICAL): string {
  return createHash('sha256').update(canonical(rows, v)).digest('hex');
}

export function memoText(day: string, count: number, hash: string, v: CanonicalVersion = CURRENT_CANONICAL): string {
  return `keyholder:program_daily:${v}:${day}:${count}:${hash}`;
}

/** Parses a memo written by memoText (any version); null for anything else. */
export function parseMemo(text: string): { version: CanonicalVersion; day: string; count: number; hash: string } | null {
  const m = /keyholder:program_daily:(v1|v2):(\d{4}-\d{2}-\d{2}):(\d+):([0-9a-f]{64})/.exec(text);
  return m ? { version: m[1] as CanonicalVersion, day: m[2]!, count: Number(m[3]), hash: m[4]! } : null;
}

export async function anchor(connection: Connection, payer: Keypair, text: string): Promise<{ signature: string; slot: number }> {
  const tx = new Transaction().add(new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }], data: Buffer.from(text, 'utf8') }));
  const signature = await sendAndConfirmTransaction(connection, tx, [payer], { commitment: 'confirmed' });
  const st = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
  return { signature, slot: st.value?.slot ?? 0 };
}
