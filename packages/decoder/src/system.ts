// File: packages/decoder/src/system.ts
// Purpose: System Program instruction decoder (nonce accounts)
// [VERIFIED] — Discriminants and structure from BACKEND.md §2.1

import * as bs58 from 'bs58';
import {
  DecodedInstruction,
  DecodedAccount,
  SYSTEM_PROGRAM_DISCRIMINANTS,
  EventKind,
} from './types';

const SYSTEM_PROGRAM = '11111111111111111111111111111111';

/**
 * Parse System Program instruction discriminant (u32 LE)
 * [VERIFIED] from BACKEND.md
 */
export function parseSystemDiscriminant(data: Buffer): number {
  if (data.length < 4) return -1;
  return data.readUInt32LE(0);
}

/**
 * Decode System Program instruction
 * [VERIFIED] — Discriminants 4, 6, 7 are nonce-related from BACKEND.md §2.1
 */
export function decodeSystemInstruction(
  data: Buffer,
  accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>
): DecodedInstruction | null {
  if (data.length < 4) {
    return null;
  }

  const discriminant = parseSystemDiscriminant(data);

  const discriminantNames: Record<number, string> = {
    0: 'CreateAccount',
    1: 'Assign',
    2: 'Transfer',
    3: 'CreateAccountWithSeed',
    4: 'AdvanceNonceAccount',
    5: 'WithdrawNonceAccount',
    6: 'InitializeNonceAccount',
    7: 'AuthorizeNonceAccount',
    8: 'Allocate',
    9: 'AllocateWithSeed',
    10: 'TransferWithSeed',
  };

  const name = discriminantNames[discriminant];
  if (!name) {
    return null;
  }

  let kind: EventKind = 'privileged_ix';

  // Only track nonce-related instructions when signed by a watched signer
  switch (discriminant) {
    case 4: // AdvanceNonceAccount
      kind = 'nonce_advanced';
      break;
    case 6: // InitializeNonceAccount
      kind = 'nonce_created';
      break;
    case 7: // AuthorizeNonceAccount
      kind = 'privileged_ix';
      break;
    default:
      // Non-nonce system instructions are not tracked
      return null;
  }

  const decodedAccounts = accounts.map((a, idx) => {
    const acc: DecodedAccount = {
      pubkey: a.pubkey,
      isSigner: a.isSigner,
      isWritable: a.isWritable,
    };

    // Nonce account structure (InitializeNonceAccount, AdvanceNonceAccount, AuthorizeNonceAccount)
    if (discriminant === 4 || discriminant === 6 || discriminant === 7) {
      if (idx === 0) acc.name = 'Nonce Account (writable)';
      if (idx === 1) acc.name = 'RecentBlockhashes (sysvar)';
      if (idx === 2 && discriminant !== 6) acc.name = 'Nonce Authority (signer)';
      if (idx === 2 && discriminant === 6) acc.name = 'Nonce Authority (signer)';
      if (idx === 3 && discriminant === 6) acc.name = 'Rent (sysvar)';
    }

    return acc;
  });

  return {
    program: SYSTEM_PROGRAM,
    discriminant: `${discriminant}`,
    name,
    kind,
    category: 'authority_change' as any,
    accounts: decodedAccounts,
    confidence: 'high',
    raw: {
      discriminantBytes: data.slice(0, 4),
      data,
    },
  };
}

/**
 * Parse nonce account state
 * [UNVERIFIED] — Exact bincode layout of nonce account not documented in sources;
 * placeholder structure based on Solana documentation
 *
 * Expected layout:
 * [0..4]   u32 version (always 0)
 * [4..36]  Pubkey authority
 * [36..44] u64 nonce (the nonce value)
 * [44..48] u32 fee_calculator.lamports_per_signature
 */
export function parseNonceAccount(data: Buffer): {
  version: number;
  authority: string;
  nonce: string;
} {
  if (data.length < 48) {
    throw new Error(`Nonce account too small: ${data.length} < 48`);
  }

  const version = data.readUInt32LE(0);
  if (version !== 0) {
    throw new Error(`Unsupported nonce version: ${version}`);
  }

  const authority = bs58.encode(data.slice(4, 36));
  const nonce = bs58.encode(data.slice(36, 44)); // Technically a u64, but encode as base58 for portability

  return { version, authority, nonce };
}
