// File: apps/worker/src/pipeline/parse-raw-tx.ts
//
// Decode stage, step 0: reconstruct a flat, program-agnostic instruction
// list from a `raw_tx.tx` bytea column. That column holds
// `JSON.stringify(tx, bigint->string)` of a real
// `VersionedTransactionResponse` from `connection.getTransaction()` (see
// ingest/index.ts's `serializeRaw`) — not the live web3.js object, so
// normalize.ts's class-method-based approach (`message.compiledInstructions`,
// `message.isAccountSigner`) doesn't apply to the round-tripped JSON: those
// are getters/methods, not enumerable own properties, and are gone after
// JSON.parse.
//
// Empirically verified against real mainnet responses (2026-09-26, live
// Helius `getTransaction` calls, see this task's report):
//   - legacy message JSON shape: {header, accountKeys: string[], recentBlockhash,
//     instructions: [{programIdIndex, accounts: number[], data: base58 string}]}
//   - v0 message JSON shape: {header, staticAccountKeys: string[], recentBlockhash,
//     compiledInstructions: [{programIdIndex, accountKeyIndexes: number[], data: {type:'Buffer', data:number[]}}],
//     addressTableLookups: [...]}
//   - meta.innerInstructions[].instructions always use the legacy shape
//     ({programIdIndex, accounts: number[], data: base58 string}) regardless
//     of the outer message version — the RPC always returns inner
//     instructions in the compiled/base58 form.
//   - full account-key index space, both versions: staticAccountKeys (or
//     accountKeys) ++ meta.loadedAddresses.writable ++ meta.loadedAddresses.readonly
//     (@solana/web3.js `MessageAccountKeys.keySegments()`).
//   - `isAccountSigner(index)` reduces to `index < header.numRequiredSignatures`
//     for both legacy `Message` and `MessageV0` (verified from source).

import bs58 from 'bs58';

export class RawTxParseError extends Error {}

export interface FlatInstruction {
  /** '3' for a top-level instruction, '3.1' for its second inner instruction. */
  ixPath: string;
  programId: string;
  data: Buffer;
  accounts: Array<{ pubkey: string; isSigner: boolean }>;
}

export interface ParsedStoredTx {
  slot: number;
  blockTime: Date | null;
  instructions: FlatInstruction[];
}

interface StoredCompiledIx {
  programIdIndex: number;
  accounts?: number[];
  accountKeyIndexes?: number[];
  data: string | { type: 'Buffer'; data: number[] };
}

function ixData(raw: StoredCompiledIx['data']): Buffer {
  if (typeof raw === 'string') return Buffer.from(bs58.decode(raw));
  if (raw && typeof raw === 'object' && Array.isArray(raw.data)) return Buffer.from(raw.data);
  throw new RawTxParseError(`unrecognized instruction data shape: ${JSON.stringify(raw)}`);
}

function ixAccountIndexes(ix: StoredCompiledIx): number[] {
  return ix.accountKeyIndexes ?? ix.accounts ?? [];
}

/** JSON.parse the stored bytea buffer into the plain object it was serialized from. */
export function parseStoredTx(buf: Buffer): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(buf.toString('utf8'));
  } catch (err) {
    throw new RawTxParseError(`raw_tx.tx is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new RawTxParseError('raw_tx.tx JSON did not parse to an object');
  }
  return parsed;
}

/**
 * Flattens a parsed `VersionedTransactionResponse`-shaped JSON object into
 * program-agnostic instructions, in the same order the decode stage assigns
 * `ix_path` (top-level instructions in message order, each one's inner
 * instructions immediately after it in inner-index order).
 */
export function flattenStoredTx(parsed: unknown): ParsedStoredTx {
  const root = parsed as Record<string, unknown>;
  const txField = root.transaction as Record<string, unknown> | undefined;
  const message = txField?.message as Record<string, unknown> | undefined;
  if (!message) {
    throw new RawTxParseError('raw_tx.tx JSON missing transaction.message');
  }
  const meta = (root.meta as Record<string, unknown> | undefined) ?? {};
  const header = message.header as { numRequiredSignatures: number } | undefined;
  if (!header || typeof header.numRequiredSignatures !== 'number') {
    throw new RawTxParseError('raw_tx.tx JSON missing transaction.message.header.numRequiredSignatures');
  }

  const staticKeys: string[] = (message.staticAccountKeys as string[] | undefined) ?? (message.accountKeys as string[] | undefined) ?? [];
  const loaded = (meta.loadedAddresses as { writable?: string[]; readonly?: string[] } | undefined) ?? {};
  const fullKeys: string[] = [...staticKeys, ...(loaded.writable ?? []), ...(loaded.readonly ?? [])];

  const keyAt = (index: number): string => fullKeys[index] ?? '';
  const isSigner = (index: number): boolean => index < header.numRequiredSignatures;

  const topLevel: StoredCompiledIx[] =
    (message.compiledInstructions as StoredCompiledIx[] | undefined) ?? (message.instructions as StoredCompiledIx[] | undefined) ?? [];

  const innerGroups = (meta.innerInstructions as Array<{ index: number; instructions: StoredCompiledIx[] }> | undefined) ?? [];
  const innerByTopIndex = new Map<number, StoredCompiledIx[]>();
  for (const group of innerGroups) innerByTopIndex.set(group.index, group.instructions ?? []);

  const flat: FlatInstruction[] = [];
  topLevel.forEach((ix, i) => {
    const indexes = ixAccountIndexes(ix);
    flat.push({
      ixPath: String(i),
      programId: keyAt(ix.programIdIndex),
      data: ixData(ix.data),
      accounts: indexes.map((idx) => ({ pubkey: keyAt(idx), isSigner: isSigner(idx) })),
    });
    const inner = innerByTopIndex.get(i) ?? [];
    inner.forEach((innerIx, j) => {
      const innerIndexes = ixAccountIndexes(innerIx);
      flat.push({
        ixPath: `${i}.${j}`,
        programId: keyAt(innerIx.programIdIndex),
        data: ixData(innerIx.data),
        accounts: innerIndexes.map((idx) => ({ pubkey: keyAt(idx), isSigner: isSigner(idx) })),
      });
    });
  });

  const slot = typeof root.slot === 'number' ? root.slot : Number(root.slot);
  const blockTime = typeof root.blockTime === 'number' ? new Date(root.blockTime * 1000) : null;

  return { slot, blockTime, instructions: flat };
}

/** Convenience: parse + flatten in one call. */
export function parseAndFlattenRawTx(buf: Buffer): ParsedStoredTx {
  return flattenStoredTx(parseStoredTx(buf));
}
