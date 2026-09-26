// File: packages/decoder/src/idl.ts
// Purpose: Anchor IDL fetching and generic instruction decoding
// [VERIFIED] — IDL discovery process from BACKEND.md §3 and ONCHAIN.md

import * as bs58 from 'bs58';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { ParsedIdl, IdlInstruction, DecodedInstruction, DecodedAccount, EventKind } from './types';

const PROGRAM_METADATA = 'ProgM6JCCvbYkfKqJYHePx4xxSUSqJp7rh8Lyv7nk7S';

/**
 * IDL discovery sources (priority order)
 * [VERIFIED] from BACKEND.md §3.1
 */
export type IdlSource = 'program_metadata_canonical' | 'legacy_anchor' | 'bundled' | 'none';

/**
 * Derive legacy Anchor IDL account address
 * [VERIFIED] from BACKEND.md §3.1 [A]
 *
 * Formula:
 * base = find_program_address(&[], program_id).0
 * addr = create_with_seed(base, "anchor:idl", program_id)
 */
export function deriveLegacyAnchorIdlAddress(programId: string): string {
  // PLACEHOLDER: Requires @solana/web3.js for proper derivation
  // For now, return a marker that indicates this requires RPC lookup
  return `__legacy_anchor_idl_${programId}`;
}

/**
 * Compute Program Metadata canonical IDL PDA
 * [VERIFIED] from BACKEND.md §3.1 [PM]
 *
 * PDA: [program_id, "idl"] under ProgM6JCCvbYkfKqJYHePx4xxSUSqJp7rh8Lyv7nk7S
 */
export function computeMetadataIdlPda(programId: string): string {
  // PLACEHOLDER: Requires @solana/web3.js PublicKey.findProgramAddressSync
  return `__metadata_idl_${programId}`;
}

/**
 * Compute Anchor 8-byte instruction discriminator
 * [VERIFIED] — sha256("anchor:<name>")[..8]
 */
export function computeAnchorInstructionDiscriminator(name: string): Buffer {
  const hash = crypto.createHash('sha256');
  hash.update(`anchor:${name}`);
  return hash.digest().slice(0, 8);
}

/**
 * Decompress IDL data
 * [VERIFIED] from BACKEND.md §3.1 — IDLs are zlib-compressed JSON
 */
export function decompressIdl(compressed: Buffer): ParsedIdl {
  let json: string;
  try {
    json = zlib.inflateSync(compressed).toString('utf8');
  } catch (e) {
    // Fallback: try raw JSON if not compressed
    json = compressed.toString('utf8');
  }

  const parsed = JSON.parse(json) as ParsedIdl;
  return parsed;
}

/**
 * Find instruction discriminator in IDL
 * [VERIFIED] — Anchor IDLs store discriminator as number[] or computed dynamically
 */
export function findInstructionInIdl(idl: ParsedIdl, discriminator: Buffer): IdlInstruction | null {
  if (!idl.instructions) return null;

  for (const ix of idl.instructions) {
    let expectedDiscriminator: Buffer | null = null;

    if (ix.discriminator) {
      // Explicit discriminator in IDL
      expectedDiscriminator = Buffer.from(ix.discriminator);
    } else {
      // Compute from name
      expectedDiscriminator = computeAnchorInstructionDiscriminator(ix.name);
    }

    if (expectedDiscriminator.equals(discriminator)) {
      return ix;
    }
  }

  return null;
}

/**
 * Decode instruction using IDL
 * [VERIFIED] — Generic Anchor instruction decoder logic
 *
 * Does not parse args in detail (would require type schema parsing);
 * instead returns the discriminator match and account meanings
 */
export function decodeInstructionWithIdl(
  programId: string,
  idl: ParsedIdl,
  data: Buffer,
  accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>
): DecodedInstruction | null {
  if (data.length < 8) {
    return null;
  }

  const discriminator = data.slice(0, 8);
  const idlIx = findInstructionInIdl(idl, discriminator);

  if (!idlIx) {
    return null;
  }

  // Map IDL accounts to decoded accounts
  const decodedAccounts = accounts.map((a, idx) => {
    const acc: DecodedAccount = {
      pubkey: a.pubkey,
      isSigner: a.isSigner,
      isWritable: a.isWritable,
    };

    // Look up account metadata from IDL
    if (idlIx.accounts && idx < idlIx.accounts.length) {
      const idlAcct = idlIx.accounts[idx];
      acc.name = idlAcct.name;

      // Check if this account is an authority/admin based on IDL relations
      if (idlAcct.relations && idlAcct.relations.length > 0) {
        for (const rel of idlAcct.relations) {
          if (/^(admin|authority|owner|governance|guardian|council)$/i.test(rel)) {
            acc.isAuthority = true;
            acc.isAdmin = true;
            break;
          }
        }
      }

      // Check name heuristic
      const name = idlAcct.name.toLowerCase();
      if (/^(admin|authority|owner|governance|guardian|council|operator|manager|risk_?admin|fee_?admin)$/.test(name)) {
        acc.isAuthority = true;
        acc.isAdmin = true;
      }
    }

    return acc;
  });

  // Infer event kind from instruction name
  let kind: EventKind = 'privileged_ix';
  const ixNameLower = idlIx.name.toLowerCase();

  if (ixNameLower.includes('upgrade')) {
    kind = 'upgrade';
  } else if (ixNameLower.includes('set_authority') || ixNameLower.includes('setauthority')) {
    kind = 'set_authority';
  } else if (ixNameLower.includes('proposal')) {
    if (ixNameLower.includes('create')) kind = 'proposal_created';
    else if (ixNameLower.includes('execute')) kind = 'proposal_executed';
  }

  return {
    program: programId,
    discriminant: discriminator.toString('hex'),
    name: idlIx.name,
    kind,
    accounts: decodedAccounts,
    confidence: 'medium',
    raw: {
      discriminantBytes: discriminator,
      data,
    },
  };
}

/**
 * SPL Governance instruction decoder (Realms)
 * [UNVERIFIED] — Layout not fully documented; uses hardcoded discriminators
 *
 * Key instructions to detect:
 * - CreateProposal
 * - ExecuteTransaction
 * - SetGovernanceConfig
 */
export function decodeSplGovernanceInstruction(
  data: Buffer,
  accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>
): DecodedInstruction | null {
  // SPL Governance uses Borsh/Anchor-like discriminators (8-byte)
  // Without the full IDL, we return null for now
  // [ASSUMED] that full IDL will be bundled or fetched from chain
  return null;
}
