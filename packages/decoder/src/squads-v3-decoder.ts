// File: packages/decoder/src/squads-v3-decoder.ts
// [DESIGNED + BUILT against the real, published squads-mpl source
// (github.com/Squads-Protocol/squads-mpl, `programs/squads-mpl/src/state.rs`
// and `lib.rs`, fetched live via `gh api` 2026-09-26); UNTESTED against a
// real on-chain fixture — this task's live authority-resolution run did not
// turn up any of the 15 tracked programs actually controlled by a v3
// multisig (see authority-history.ts's report). Program id and account
// layout are verified against the real source, not memory: see the two
// `gh api` calls in this task's session for the exact bytes fetched.
//
// Squads v3 ("squads-mpl", the predecessor to v4/"SQDS4ep...") differs from
// v4 in two ways this task's classification cares about: it has no
// `time_lock` field at all (the multisig has no built-in timelock concept),
// and vault/authority PDAs are 1-indexed (index 0 is reserved for internal
// instructions per the program's own doc comment), not 0-indexed like v4.

import bs58 from 'bs58';
import { createHash } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { DiscriminatorMismatchError, TruncatedBufferError } from './errors';

/** Real, verified 2026-09-26 via `gh api repos/Squads-Protocol/squads-mpl/.../lib.rs` → `declare_id!(...)`. */
export const SQUADS_V3_PROGRAM_ID = 'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu';

export interface SquadsV3Multisig {
  threshold: number;
  authorityIndex: number;
  transactionIndex: number;
  msChangeIndex: number;
  bump: number;
  createKey: string;
  allowExternalExecute: boolean;
  members: string[];
}

const SQUADS_V3_MS_DISCRIMINATOR = createHash('sha256').update('account:Ms').digest().subarray(0, 8);

/**
 * Parse a Squads v3 `Ms` (multisig) account. Layout, field by field (real
 * source, `state.rs`'s `Ms` struct and `SIZE_WITHOUT_MEMBERS` const):
 * [0..8) discriminator, [8..10) u16 threshold, [10..12) u16 authority_index,
 * [12..16) u32 transaction_index, [16..20) u32 ms_change_index, [20] u8 bump,
 * [21..53) Pubkey create_key, [53] bool allow_external_execute,
 * [54..58) u32 Vec<Pubkey> length prefix, then 32 bytes per member.
 */
export function parseSquadsV3Multisig(data: Buffer): SquadsV3Multisig {
  if (data.length < 8) {
    throw new TruncatedBufferError('parseSquadsV3Multisig discriminator', 8, data.length);
  }
  const discriminator = data.subarray(0, 8);
  if (!discriminator.equals(SQUADS_V3_MS_DISCRIMINATOR)) {
    throw new DiscriminatorMismatchError(
      'parseSquadsV3Multisig discriminator',
      SQUADS_V3_MS_DISCRIMINATOR.toString('hex'),
      discriminator.toString('hex')
    );
  }
  if (data.length < 58) {
    throw new TruncatedBufferError('parseSquadsV3Multisig fixed fields', 58, data.length);
  }

  const threshold = data.readUInt16LE(8);
  const authorityIndex = data.readUInt16LE(10);
  const transactionIndex = data.readUInt32LE(12);
  const msChangeIndex = data.readUInt32LE(16);
  const bump = data.readUInt8(20);
  const createKey = bs58.encode(data.subarray(21, 53));
  const allowExternalExecute = data.readUInt8(53) !== 0;
  const memberCount = data.readUInt32LE(54);

  const membersStart = 58;
  const membersEnd = membersStart + memberCount * 32;
  if (data.length < membersEnd) {
    throw new TruncatedBufferError('parseSquadsV3Multisig members', membersEnd, data.length);
  }
  const members: string[] = [];
  for (let i = 0; i < memberCount; i++) {
    members.push(bs58.encode(data.subarray(membersStart + i * 32, membersStart + (i + 1) * 32)));
  }

  return { threshold, authorityIndex, transactionIndex, msChangeIndex, bump, createKey, allowExternalExecute, members };
}

/**
 * Derive a Squads v3 vault/authority PDA: ["squad", multisig_pubkey,
 * authority_index (u32 LE), "authority"] — real seeds, from `lib.rs`'s
 * `create_transaction` handler. Note the seed uses the multisig's own
 * pubkey, not its `create_key` (unlike the multisig PDA itself, which is
 * `["squad", create_key, "multisig"]`).
 */
export function deriveSquadsV3VaultPda(
  multisig: PublicKey,
  authorityIndex: number,
  programId: PublicKey = new PublicKey(SQUADS_V3_PROGRAM_ID)
): PublicKey {
  const indexBuf = Buffer.alloc(4);
  indexBuf.writeUInt32LE(authorityIndex, 0);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('squad'), multisig.toBuffer(), indexBuf, Buffer.from('authority')],
    programId
  );
  return pda;
}

export interface ResolvedSquadsV3Vault {
  multisig: string;
  authorityIndex: number;
}

/**
 * Given a vault/authority address and candidate multisig addresses, find
 * which one derives that vault at which authority index. Index 0 is
 * reserved for internal instructions (real source comment); the default
 * vault is index 1, so this starts there.
 */
export function resolveSquadsV3Vault(
  vaultAddress: string,
  candidateMultisigs: string[],
  maxIndex = 4
): ResolvedSquadsV3Vault | null {
  const vault = new PublicKey(vaultAddress);
  for (const candidate of candidateMultisigs) {
    const multisigPk = new PublicKey(candidate);
    for (let authorityIndex = 1; authorityIndex <= maxIndex; authorityIndex++) {
      const pda = deriveSquadsV3VaultPda(multisigPk, authorityIndex);
      if (pda.equals(vault)) {
        return { multisig: candidate, authorityIndex };
      }
    }
  }
  return null;
}
