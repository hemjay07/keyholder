// File: packages/decoder/src/byte-parser.ts
// [TESTED against real mainnet bytes, 2026-09-26 — see evidence/2026-09-26-drift-control-state.md]
//
// BPF Upgradeable Loader v3 Program/ProgramData layouts: bincode-encoded
// Rust enum. The u32 LE tag at offset 0 selects the variant (0=Uninitialized,
// 1=Buffer, 2=Program, 3=ProgramData).
//
// Squads v4 Multisig layout: Anchor account. First 8 bytes are the account
// discriminator sha256("account:Multisig")[..8]. rent_collector is an
// Option<Pubkey> whose tag sits at offset 94 — everything after it is only
// known once that tag is read (the Borsh trap this task calls out).

import bs58 from 'bs58';
import { createHash } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { DiscriminatorMismatchError, TruncatedBufferError } from './errors';

export const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = 'BPFLoaderUpgradeab1e11111111111111111111111';
export const SQUADS_V4_PROGRAM_ID = 'SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf';

// ── Program account (loader tag 2) ─────────────────────────────────────────

export interface ProgramAccount {
  tag: 2;
  programDataAddress: string;
}

/**
 * Parse the executable "Program" account written by the BPF Upgradeable
 * Loader. Layout: [0..4) u32 tag=2, [4..36) Pubkey programdata_address.
 */
export function parseProgramAccount(data: Buffer): ProgramAccount {
  if (data.length < 36) {
    throw new TruncatedBufferError('parseProgramAccount', 36, data.length);
  }
  const tag = data.readUInt32LE(0);
  if (tag !== 2) {
    throw new DiscriminatorMismatchError('parseProgramAccount tag', '2 (Program)', String(tag));
  }
  const programDataAddress = bs58.encode(data.subarray(4, 36));
  return { tag, programDataAddress };
}

// ── ProgramData account (loader tag 3) ─────────────────────────────────────

export interface ProgramDataAccount {
  tag: 3;
  lastDeploySlot: bigint;
  /** null when the program is immutable (Option<Pubkey> == None) */
  upgradeAuthority: string | null;
}

/**
 * Parse the "ProgramData" account written by the BPF Upgradeable Loader.
 * Layout: [0..4) u32 tag=3, [4..12) u64 LE last_deploy_slot,
 * [12] Option<Pubkey> tag, [13..45) Pubkey upgrade_authority iff tag==1.
 * The 45-byte header is only present when the authority is Some; an
 * immutable program's account can be as short as 13 bytes.
 */
export function parseProgramData(data: Buffer): ProgramDataAccount {
  if (data.length < 13) {
    throw new TruncatedBufferError('parseProgramData header', 13, data.length);
  }
  const tag = data.readUInt32LE(0);
  if (tag !== 3) {
    throw new DiscriminatorMismatchError('parseProgramData tag', '3 (ProgramData)', String(tag));
  }
  const lastDeploySlot = data.readBigUInt64LE(4);
  const optionTag = data.readUInt8(12);

  if (optionTag === 0) {
    return { tag, lastDeploySlot, upgradeAuthority: null };
  }
  if (optionTag !== 1) {
    throw new DiscriminatorMismatchError(
      'parseProgramData upgrade_authority Option tag',
      '0 (None) or 1 (Some)',
      String(optionTag)
    );
  }
  if (data.length < 45) {
    throw new TruncatedBufferError('parseProgramData upgrade_authority', 45, data.length);
  }
  const upgradeAuthority = bs58.encode(data.subarray(13, 45));
  return { tag, lastDeploySlot, upgradeAuthority };
}

// ── Squads v4 Multisig account ──────────────────────────────────────────────

export interface SquadsMember {
  key: string;
  permissions: number;
}

export interface SquadsV4Multisig {
  createKey: string;
  configAuthority: string;
  threshold: number;
  timeLock: number;
  transactionIndex: bigint;
  staleTransactionIndex: bigint;
  /** null when Option<Pubkey> == None (tag at offset 94) */
  rentCollector: string | null;
  bump: number;
  members: SquadsMember[];
}

const SQUADS_MULTISIG_DISCRIMINATOR = createHash('sha256').update('account:Multisig').digest().subarray(0, 8);

/**
 * Parse a Squads v4 Multisig account, field by field:
 * [0..8) discriminator, [8..40) create_key, [40..72) config_authority,
 * [72..74) u16 threshold, [74..78) u32 time_lock, [78..86) u64 transaction_index,
 * [86..94) u64 stale_transaction_index, [94] Option<Pubkey> rent_collector tag
 * (+32 bytes iff Some), then u8 bump, then Vec<Member> (u32 LE length prefix,
 * each member = 32-byte key + 1-byte permissions).
 */
export function parseSquadsV4Multisig(data: Buffer): SquadsV4Multisig {
  if (data.length < 8) {
    throw new TruncatedBufferError('parseSquadsV4Multisig discriminator', 8, data.length);
  }
  const discriminator = data.subarray(0, 8);
  if (!discriminator.equals(SQUADS_MULTISIG_DISCRIMINATOR)) {
    throw new DiscriminatorMismatchError(
      'parseSquadsV4Multisig discriminator',
      SQUADS_MULTISIG_DISCRIMINATOR.toString('hex'),
      discriminator.toString('hex')
    );
  }
  if (data.length < 94) {
    throw new TruncatedBufferError('parseSquadsV4Multisig fixed fields', 94, data.length);
  }

  const createKey = bs58.encode(data.subarray(8, 40));
  const configAuthority = bs58.encode(data.subarray(40, 72));
  const threshold = data.readUInt16LE(72);
  const timeLock = data.readUInt32LE(74);
  const transactionIndex = data.readBigUInt64LE(78);
  const staleTransactionIndex = data.readBigUInt64LE(86);

  // The Borsh trap: nothing past this point has a fixed offset until the
  // Option tag is read.
  let offset = 94;
  if (data.length < offset + 1) {
    throw new TruncatedBufferError('parseSquadsV4Multisig rent_collector tag', offset + 1, data.length);
  }
  const rentCollectorTag = data.readUInt8(offset);
  offset += 1;

  let rentCollector: string | null = null;
  if (rentCollectorTag === 1) {
    if (data.length < offset + 32) {
      throw new TruncatedBufferError('parseSquadsV4Multisig rent_collector pubkey', offset + 32, data.length);
    }
    rentCollector = bs58.encode(data.subarray(offset, offset + 32));
    offset += 32;
  } else if (rentCollectorTag !== 0) {
    throw new DiscriminatorMismatchError(
      'parseSquadsV4Multisig rent_collector Option tag',
      '0 (None) or 1 (Some)',
      String(rentCollectorTag)
    );
  }

  if (data.length < offset + 1) {
    throw new TruncatedBufferError('parseSquadsV4Multisig bump', offset + 1, data.length);
  }
  const bump = data.readUInt8(offset);
  offset += 1;

  if (data.length < offset + 4) {
    throw new TruncatedBufferError('parseSquadsV4Multisig members length prefix', offset + 4, data.length);
  }
  const memberCount = data.readUInt32LE(offset);
  offset += 4;

  const MEMBER_SIZE = 33; // 32-byte pubkey + 1-byte permissions
  const membersEnd = offset + memberCount * MEMBER_SIZE;
  if (data.length < membersEnd) {
    throw new TruncatedBufferError('parseSquadsV4Multisig members', membersEnd, data.length);
  }

  const members: SquadsMember[] = [];
  for (let i = 0; i < memberCount; i++) {
    const key = bs58.encode(data.subarray(offset, offset + 32));
    const permissions = data.readUInt8(offset + 32);
    members.push({ key, permissions });
    offset += MEMBER_SIZE;
  }

  return {
    createKey,
    configAuthority,
    threshold,
    timeLock,
    transactionIndex,
    staleTransactionIndex,
    rentCollector,
    bump,
    members,
  };
}

// ── Squads vault resolution ─────────────────────────────────────────────────

/**
 * Derive a Squads v4 vault PDA: ["multisig", multisig, "vault", index: u8].
 */
export function deriveSquadsVaultPda(
  multisig: PublicKey,
  vaultIndex: number,
  programId: PublicKey = new PublicKey(SQUADS_V4_PROGRAM_ID)
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('multisig'), multisig.toBuffer(), Buffer.from('vault'), Buffer.from([vaultIndex])],
    programId
  );
  return pda;
}

export interface ResolvedSquadsVault {
  multisig: string;
  vaultIndex: number;
}

/**
 * A system-owned vault address does not point back to its controlling
 * multisig on its own (it has no account data). Given the vault address and
 * a list of candidate multisig addresses, find which one derives that vault
 * at which index (0..maxIndex inclusive).
 */
export function resolveSquadsVault(
  vaultAddress: string,
  candidateMultisigs: string[],
  maxIndex = 3
): ResolvedSquadsVault | null {
  const vault = new PublicKey(vaultAddress);
  for (const candidate of candidateMultisigs) {
    const multisigPk = new PublicKey(candidate);
    for (let vaultIndex = 0; vaultIndex <= maxIndex; vaultIndex++) {
      const pda = deriveSquadsVaultPda(multisigPk, vaultIndex);
      if (pda.equals(vault)) {
        return { multisig: candidate, vaultIndex };
      }
    }
  }
  return null;
}
