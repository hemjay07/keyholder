// File: packages/decoder/src/idl-loader.ts
// [TESTED against real mainnet accounts, 2026-09-26]
//
// IDL discovery, in the order given by BACKEND.md §3.1:
//   1. Program Metadata canonical IDL — PDA [program_id, "idl"] under the
//      Program Metadata program (ProgM6JC…).
//   2. Legacy Anchor IDL account — createWithSeed(base, "anchor:idl", program).
// Both were verified against real accounts before this file was written:
//   - Drift (dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH): both paths hit
//     (canonical PDA 7DuBKBbixzCJEFgvAxpt7MCUuSwuY854iYJ4BLpzPEVt, legacy
//     account 8BKPjRu7Hvd6Y2J67EdLx9MsrZFQwEMVwYg7NeVbAPF8).
//   - Kamino Lending (KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD) and Squads
//     v4 (SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf): legacy path only —
//     neither publishes a canonical Program Metadata IDL today.
//
// The legacy IDL account discriminator is NOT sha256("account:IdlAccount");
// Anchor hardcodes it as a fixed byte array (verified: real Drift/Kamino/
// Squads accounts all start with this exact sequence).
//
// The Program Metadata "Metadata" account header is 96 bytes on the wire,
// four bytes more than the 92 bytes the account's own generated TS decoder
// (github.com/solana-program/program-metadata) declares as its struct
// fields (discriminator 1 + program 32 + authority 32 + mutable 1 +
// canonical 1 + seed 16 + encoding 1 + compression 1 + format 1 +
// dataSource 1 + dataLength 5 = 92). The real Drift account has four zero
// bytes at [92..96) that are not part of any declared field before the
// zlib stream starts at byte 96 — [DEV-008, UNTESTED reason: the upstream
// codama-generated client does not explain this gap; empirically confirmed
// on one real account (Drift) and treated as a fixed reserved/padding
// region until a second canonical-IDL program is found to cross-check].

import { Connection, PublicKey } from '@solana/web3.js';
import { createHash } from 'node:crypto';
import { inflateSync, gunzipSync } from 'node:zlib';
import { DecodeError } from './errors';

export const PROGRAM_METADATA_PROGRAM_ID = 'ProgM6JCCvbYkfKqJYHePx4xxSUSqJp7rh8Lyv7nk7S';

/** Fixed discriminator Anchor writes at the start of a legacy IDL account. */
const LEGACY_IDL_DISCRIMINATOR = Buffer.from([24, 70, 98, 191, 58, 144, 123, 158]);

export type IdlSource = 'program_metadata' | 'legacy_anchor';

export interface DiscoveredIdl {
  idl: Record<string, unknown>;
  source: IdlSource;
  address: string;
}

export class IdlNotSupportedError extends DecodeError {
  constructor(reason: string) {
    super(`IDL discovery: ${reason}`);
    this.name = 'IdlNotSupportedError';
  }
}

// ── Legacy Anchor IDL account ───────────────────────────────────────────────

/**
 * `createWithSeed(base, "anchor:idl", programId)` where
 * `base = findProgramAddress([], programId)`. Node's crypto sha256 of
 * base(32) + seed(utf8) + owner(32) reproduces Solana's `createWithSeed`.
 */
export function legacyAnchorIdlAddress(programId: PublicKey): PublicKey {
  const [base] = PublicKey.findProgramAddressSync([], programId);
  const buf = Buffer.concat([base.toBuffer(), Buffer.from('anchor:idl', 'utf8'), programId.toBuffer()]);
  return new PublicKey(createHash('sha256').update(buf).digest());
}

/**
 * Layout: [0..8) fixed discriminator, [8..40) authority Pubkey,
 * [40..44) u32 LE data_len, [44..44+data_len) zlib-deflated IDL JSON.
 */
export function decodeLegacyAnchorIdlAccount(data: Buffer): Record<string, unknown> {
  if (data.length < 44) {
    throw new IdlNotSupportedError(`legacy IDL account truncated: need >= 44 bytes, have ${data.length}`);
  }
  const discriminator = data.subarray(0, 8);
  if (!discriminator.equals(LEGACY_IDL_DISCRIMINATOR)) {
    throw new IdlNotSupportedError(
      `legacy IDL discriminator mismatch: expected ${LEGACY_IDL_DISCRIMINATOR.toString('hex')}, got ${discriminator.toString('hex')}`
    );
  }
  const dataLen = data.readUInt32LE(40);
  const compressed = data.subarray(44, 44 + dataLen);
  const json = inflateSync(compressed).toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
}

export async function loadIdlFromLegacyAnchor(
  programId: PublicKey,
  connection: Connection
): Promise<DiscoveredIdl | null> {
  const address = legacyAnchorIdlAddress(programId);
  const account = await connection.getAccountInfo(address, { commitment: 'confirmed' });
  if (!account) return null;
  const idl = decodeLegacyAnchorIdlAccount(account.data);
  return { idl, source: 'legacy_anchor', address: address.toBase58() };
}

// ── Program Metadata canonical IDL ──────────────────────────────────────────

/** `seeds = [program_id, seed]`; `seed` is UTF-8, right-padded with zero bytes to 16. */
function fixedSeed16(seed: string): Buffer {
  const buf = Buffer.alloc(16, 0);
  Buffer.from(seed, 'utf8').copy(buf);
  return buf;
}

export function canonicalMetadataPda(
  programId: PublicKey,
  seed = 'idl',
  metadataProgramId: PublicKey = new PublicKey(PROGRAM_METADATA_PROGRAM_ID)
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([programId.toBuffer(), fixedSeed16(seed)], metadataProgramId);
  return pda;
}

const METADATA_HEADER_LEN = 96; // see file-header note above

enum MetadataCompression {
  None = 0,
  Gzip = 1,
  Zlib = 2,
}

enum MetadataDataSource {
  Direct = 0,
  Url = 1,
  External = 2,
}

enum MetadataFormat {
  None = 0,
  Json = 1,
  Yaml = 2,
  Toml = 3,
}

/**
 * Decode the on-chain "Metadata" account written by the Program Metadata
 * program. Only `dataSource: Direct` + `format: Json` is supported (the
 * only combination Task 2.1 requires and the only one verified against a
 * real account); `Url`/`External`/non-JSON are honestly reported as
 * unsupported rather than guessed.
 */
export function decodeProgramMetadataAccount(data: Buffer): Record<string, unknown> {
  if (data.length < METADATA_HEADER_LEN) {
    throw new IdlNotSupportedError(`metadata account truncated: need >= ${METADATA_HEADER_LEN} bytes, have ${data.length}`);
  }
  const compression = data.readUInt8(84);
  const format = data.readUInt8(85);
  const dataSource = data.readUInt8(86);
  const dataLength = data.readUInt32LE(87);

  if (dataSource !== MetadataDataSource.Direct) {
    throw new IdlNotSupportedError(`dataSource ${MetadataDataSource[dataSource] ?? dataSource} not supported (only Direct)`);
  }
  if (format !== MetadataFormat.Json) {
    throw new IdlNotSupportedError(`format ${MetadataFormat[format] ?? format} not supported (only Json)`);
  }

  const payload = data.subarray(METADATA_HEADER_LEN, METADATA_HEADER_LEN + dataLength);
  let decompressed: Buffer;
  if (compression === MetadataCompression.Zlib) decompressed = inflateSync(payload);
  else if (compression === MetadataCompression.Gzip) decompressed = gunzipSync(payload);
  else decompressed = payload;

  return JSON.parse(decompressed.toString('utf8')) as Record<string, unknown>;
}

export async function loadIdlFromProgramMetadata(
  programId: PublicKey,
  connection: Connection
): Promise<DiscoveredIdl | null> {
  const address = canonicalMetadataPda(programId);
  const account = await connection.getAccountInfo(address, { commitment: 'confirmed' });
  if (!account) return null;
  const idl = decodeProgramMetadataAccount(account.data);
  return { idl, source: 'program_metadata', address: address.toBase58() };
}

// ── Combined discovery ───────────────────────────────────────────────────────

/**
 * Try Program Metadata first (canonical, upgrade-authority-written), then
 * fall back to the legacy Anchor IDL account. Returns null if neither
 * exists — callers must record the program as undecoded, never guess.
 */
export async function discoverIdl(programId: PublicKey, connection: Connection): Promise<DiscoveredIdl | null> {
  try {
    const fromMetadata = await loadIdlFromProgramMetadata(programId, connection);
    if (fromMetadata) return fromMetadata;
  } catch {
    // fall through to legacy path; a malformed/unsupported metadata account
    // is not fatal to discovery as a whole.
  }
  return loadIdlFromLegacyAnchor(programId, connection);
}
