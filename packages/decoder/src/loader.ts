// File: packages/decoder/src/loader.ts
// Purpose: BPF Upgradeable Loader v3 instruction decoder and ProgramData account parser
// [VERIFIED] — Layout from ONCHAIN.md §5 and solana-sdk loader-v3-interface/src/state.rs

import * as bs58 from 'bs58';
import {
  DecodedInstruction,
  DecodedAccount,
  LOADER_V3_DISCRIMINANTS,
  ProgramDataState,
  EventKind,
} from './types';

const LOADER_V3 = 'BPFLoaderUpgradeab1e11111111111111111111111';

/**
 * Parse BPF Upgradeable Loader v3 instruction discriminant
 * First 4 bytes are u32 LE instruction index
 * [VERIFIED] from BACKEND.md §2.1 and research A2
 */
export function parseLoaderDiscriminant(data: Buffer): number {
  if (data.length < 4) return -1;
  return data.readUInt32LE(0);
}

/**
 * Decode Loader v3 instruction
 * [VERIFIED] — Discriminants 0-7 from ONCHAIN.md and BACKEND.md §2.1
 */
export function decodeLoaderInstruction(
  data: Buffer,
  accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>
): DecodedInstruction | null {
  if (data.length < 4) {
    return null;
  }

  const discriminant = parseLoaderDiscriminant(data);

  const discriminantNames: Record<number, string> = {
    0: 'InitializeBuffer',
    1: 'Write',
    2: 'DeployWithMaxDataLen',
    3: 'Upgrade',
    4: 'SetAuthority',
    5: 'Close',
    6: 'ExtendProgram',
    7: 'SetAuthorityChecked',
  };

  const name = discriminantNames[discriminant];
  if (!name) {
    return null;
  }

  let kind: EventKind = 'privileged_ix';
  let category = 'authority_change';

  switch (discriminant) {
    case 2: // DeployWithMaxDataLen
      kind = 'upgrade';
      category = 'authority_change';
      break;
    case 3: // Upgrade
      kind = 'upgrade';
      category = 'authority_change';
      break;
    case 4: // SetAuthority
    case 7: // SetAuthorityChecked
      kind = 'set_authority';
      category = 'authority_change';
      break;
  }

  const decodedAccounts = accounts.map((a, idx) => {
    const acc: DecodedAccount = {
      pubkey: a.pubkey,
      isSigner: a.isSigner,
      isWritable: a.isWritable,
    };

    // Loader account interpretation
    if (discriminant === 3 || discriminant === 2) {
      // Upgrade / DeployWithMaxDataLen
      if (idx === 0) acc.name = 'ProgramData (writable)';
      if (idx === 1) acc.name = 'Program (executable)';
      if (idx === 2) acc.name = 'Authority (signer)';
      if (idx === 3) acc.name = 'SpillAccount (optional, writable)';
      if (idx === 4) acc.name = 'SystemProgram';
      if (idx === 5) acc.name = 'Rent (sysvar)';
    } else if (discriminant === 4 || discriminant === 7) {
      // SetAuthority / SetAuthorityChecked
      if (idx === 0) acc.name = 'ProgramData (writable)';
      if (idx === 1) acc.name = 'Authority (signer)';
      if (idx === 2) acc.name = 'NewAuthority (optional)';
      if (a.isSigner && idx >= 1) acc.isAdmin = true;
      acc.isAuthority = a.isSigner && idx >= 1;
    }

    return acc;
  });

  // Parse args from data if available
  const args: Record<string, any> = {};
  if (discriminant === 2 && data.length >= 12) {
    // DeployWithMaxDataLen has max_data_len: u64 at offset 4
    args.max_data_len = Number(
      data.readBigUInt64LE(4)
    );
  }

  return {
    program: LOADER_V3,
    discriminant: `${discriminant}`,
    name,
    kind,
    category: category as any,
    accounts: decodedAccounts,
    args: Object.keys(args).length > 0 ? args : undefined,
    confidence: 'high',
    raw: {
      discriminantBytes: data.slice(0, 4),
      data,
    },
  };
}

/**
 * Parse ProgramData account state (bincode layout)
 * [VERIFIED] from ONCHAIN.md §5 and solana-sdk state.rs
 *
 * Layout:
 * [0..4]   u32 enum tag = 3 (ProgramData)
 * [4..12]  u64 slot (deployment slot)
 * [12]     u8 Option tag (0 None / 1 Some)
 * [13..45] Pubkey upgrade_authority (present iff tag==1)
 * [45..]   ELF bytecode
 */
export function parseProgramDataAccount(data: Buffer): ProgramDataState {
  const result: ProgramDataState = {
    slot: 0,
    upgrade_authority: null,
    dataLength: data.length,
  };

  if (data.length < 13) {
    throw new Error(`ProgramData account too small: ${data.length} < 13`);
  }

  // Parse enum tag at [0..4]
  const enumTag = data.readUInt32LE(0);
  if (enumTag !== 3) {
    throw new Error(`ProgramData enum tag mismatch: ${enumTag} != 3`);
  }

  // Parse slot at [4..12]
  result.slot = Number(data.readBigUInt64LE(4));

  // Parse Option<Pubkey> at [12..45]
  const optionTag = data[12];
  if (optionTag === 0) {
    // None — immutable
    result.upgrade_authority = null;
  } else if (optionTag === 1) {
    // Some — has authority
    if (data.length < 45) {
      throw new Error(`ProgramData too small for authority: ${data.length} < 45`);
    }
    const authoritybytes = data.slice(13, 45);
    result.upgrade_authority = bs58.encode(authoritybytes);
  } else {
    throw new Error(`Invalid Option tag at offset 12: ${optionTag}`);
  }

  // ELF starts at [45..]
  if (data.length > 45) {
    result.elf_size = data.length - 45;
  }

  return result;
}

/**
 * Parse Program account (the executable account, not ProgramData)
 * [VERIFIED] from ONCHAIN.md §5
 *
 * Layout:
 * [0..4]   u32 enum tag = 2 (Program)
 * [4..36]  Pubkey programdata_address
 * [36..]   (reserved)
 */
export function parseProgramAccount(data: Buffer): { programdata_address: string } {
  if (data.length < 36) {
    throw new Error(`Program account too small: ${data.length} < 36`);
  }

  const enumTag = data.readUInt32LE(0);
  if (enumTag !== 2) {
    throw new Error(`Program enum tag mismatch: ${enumTag} != 2`);
  }

  const programdata_address = bs58.encode(data.slice(4, 36));

  return { programdata_address };
}
