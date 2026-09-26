// File: packages/decoder/src/loader-decoder.ts
// [TESTED against real mainnet instructions for tags 1, 3, 4; see
// per-function docs below for the remaining tags, 2026-09-26]
//
// BPF Upgradeable Loader v3 instruction decoder. Unlike Anchor/Borsh, the
// loader's instructions are bincode-encoded: the discriminant is a u32 LE
// tag, and (this is the trap) a `Vec<u8>` length prefix is a u64 LE, not
// Borsh's u32. Verified against a real Write instruction (see
// loader-decoder.test.ts): tag(4) + offset(4) + len(8) + bytes(len).
//
// Tags 0, 2, 5, 6, 7 are implemented from the published, stable Solana
// source (solana-sdk `loader_upgradeable_instruction.rs`, unchanged since
// durable BPF upgrades shipped) but this task's RPC budget did not turn up
// a real transaction exercising them — logged as DEV-008 (UNTESTED against
// a live tx) rather than invented. Tags 1, 3, 4 are decoded from, and
// asserted against, real bytes pulled from Drift's actual program upgrade
// (slot 429,731,225) and its preceding buffer writes.

import { DecodeError } from './errors';

export class LoaderDecodeError extends DecodeError {}

export type LoaderInstruction =
  | { tag: 0; type: 'InitializeBuffer' }
  | { tag: 1; type: 'Write'; offset: number; bytes: Buffer } // [TESTED]
  | { tag: 2; type: 'DeployWithMaxDataLen'; maxDataLen: bigint } // [UNTESTED, DEV-008]
  | { tag: 3; type: 'Upgrade' } // [TESTED]
  | { tag: 4; type: 'SetAuthority' } // [TESTED]
  | { tag: 5; type: 'Close' } // [UNTESTED, DEV-008]
  | { tag: 6; type: 'ExtendProgram'; additionalBytes: number } // [UNTESTED, DEV-008]
  | { tag: 7; type: 'SetAuthorityChecked' }; // [UNTESTED, DEV-008]

export function decodeBpfLoaderInstruction(data: Buffer): LoaderInstruction {
  if (data.length < 4) {
    throw new LoaderDecodeError(`loader instruction truncated: need >= 4 bytes for the tag, have ${data.length}`);
  }
  const tag = data.readUInt32LE(0);
  switch (tag) {
    case 0:
      return { tag: 0, type: 'InitializeBuffer' };
    case 1: {
      if (data.length < 16) throw new LoaderDecodeError(`Write: need >= 16 bytes, have ${data.length}`);
      const offset = data.readUInt32LE(4);
      const byteLen = data.readBigUInt64LE(8); // bincode Vec<u8> length is u64, not u32
      const start = 16;
      const end = start + Number(byteLen);
      if (data.length < end) throw new LoaderDecodeError(`Write: declared ${byteLen} bytes but buffer has ${data.length - start}`);
      return { tag: 1, type: 'Write', offset, bytes: data.subarray(start, end) };
    }
    case 2: {
      if (data.length < 12) throw new LoaderDecodeError(`DeployWithMaxDataLen: need >= 12 bytes, have ${data.length}`);
      return { tag: 2, type: 'DeployWithMaxDataLen', maxDataLen: data.readBigUInt64LE(4) };
    }
    case 3:
      return { tag: 3, type: 'Upgrade' };
    case 4:
      return { tag: 4, type: 'SetAuthority' };
    case 5:
      return { tag: 5, type: 'Close' };
    case 6: {
      if (data.length < 8) throw new LoaderDecodeError(`ExtendProgram: need >= 8 bytes, have ${data.length}`);
      return { tag: 6, type: 'ExtendProgram', additionalBytes: data.readUInt32LE(4) };
    }
    case 7:
      return { tag: 7, type: 'SetAuthorityChecked' };
    default:
      throw new LoaderDecodeError(`unknown BPF Upgradeable Loader instruction tag ${tag} (expected 0-7)`);
  }
}

// ── Account-position helpers ────────────────────────────────────────────────
// The loader's instructions carry almost no data of their own; the accounts
// list is where the real information (which program, which authority) lives.
// Positions per the published instruction builders.

export interface UpgradeAccounts {
  programData: string;
  program: string;
  buffer: string;
  spill: string;
  upgradeAuthority: string;
}

/** Account order for Upgrade: [programdata, program, buffer, spill, rent, clock, authority]. Verified real. */
export function upgradeAccounts(accountPubkeys: string[]): UpgradeAccounts {
  if (accountPubkeys.length < 7) {
    throw new LoaderDecodeError(`Upgrade: need 7 accounts, have ${accountPubkeys.length}`);
  }
  return {
    programData: accountPubkeys[0]!,
    program: accountPubkeys[1]!,
    buffer: accountPubkeys[2]!,
    spill: accountPubkeys[3]!,
    upgradeAuthority: accountPubkeys[6]!,
  };
}

