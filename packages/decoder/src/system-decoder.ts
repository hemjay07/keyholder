// File: packages/decoder/src/system-decoder.ts
// [DEV-008: DESIGNED + BUILT, UNTESTED against a real fixture — see note below]
//
// System Program nonce account parser and instruction decoder. Layout and
// instruction indices are taken from the published, stable Solana source
// (solana-sdk `nonce/state.rs` and `system_instruction.rs`; System Program
// instruction indices have not changed since durable nonces shipped).
//
// DEV-008 (UNTESTED, per the binding "REAL ONLY" rule): every other decoder
// in this package was verified against a real fixture pulled from public
// RPC. A real durable-nonce account could not be found within this task's
// RPC budget — `getProgramAccounts` filtered by `owner=SystemProgram,
// dataSize=80` was rejected by the public endpoint ("Your IP or provider is
// blocked from this endpoint", 403), and no known nonce account address was
// available to probe directly (web search turned up only devnet tutorial
// addresses). This file is built and unit-tested against bytes constructed
// to match the documented layout, explicitly NOT claimed as a real-fixture
// test. Re-capturing a real fixture (e.g. via a provider with
// getProgramAccounts access, or a known nonce address) and adding it to
// test/fixtures/ should be the next action before this ships as
// [TESTED].

import { DecodeError } from './errors';
import bs58 from 'bs58';

export class SystemDecodeError extends DecodeError {}

// ── Nonce account state (80 bytes) ──────────────────────────────────────────

export interface NonceAccountState {
  /** Outer `Versions` enum discriminant: 0 = Legacy, 1 = Current. */
  version: number;
  /** Inner `State` enum discriminant: 0 = Uninitialized, 1 = Initialized. */
  state: number;
  authority: string;
  /** The durable nonce value itself (a blockhash). */
  durableNonce: string;
  lamportsPerSignature: bigint;
}

const NONCE_ACCOUNT_LEN = 80;

/**
 * Layout: [0..4) u32 version, [4..8) u32 state, [8..40) Pubkey authority,
 * [40..72) blockhash durable_nonce, [72..80) u64 lamports_per_signature.
 */
export function parseNonceAccount(data: Buffer): NonceAccountState {
  if (data.length !== NONCE_ACCOUNT_LEN) {
    throw new SystemDecodeError(`nonce account must be exactly ${NONCE_ACCOUNT_LEN} bytes, got ${data.length}`);
  }
  const version = data.readUInt32LE(0);
  const state = data.readUInt32LE(4);
  if (state !== 0 && state !== 1) {
    throw new SystemDecodeError(`nonce account state must be 0 (Uninitialized) or 1 (Initialized), got ${state}`);
  }
  return {
    version,
    state,
    authority: bs58.encode(data.subarray(8, 40)),
    durableNonce: bs58.encode(data.subarray(40, 72)),
    lamportsPerSignature: data.readBigUInt64LE(72),
  };
}

// ── System Program instructions ─────────────────────────────────────────────

export type SystemInstruction =
  | { index: 0; type: 'CreateAccount' }
  | { index: 1; type: 'Assign' }
  | { index: 2; type: 'Transfer'; lamports: bigint }
  | { index: 3; type: 'CreateAccountWithSeed' }
  | { index: 4; type: 'AdvanceNonceAccount' }
  | { index: 5; type: 'WithdrawNonceAccount'; lamports: bigint }
  | { index: 6; type: 'InitializeNonceAccount'; authorized: string }
  | { index: 7; type: 'AuthorizeNonceAccount'; newAuthorized: string }
  | { index: number; type: 'Other' };

/**
 * Only the nonce-relevant instructions (4, 5, 6, 7) plus Transfer (2, for
 * the "lamports" arg shape reference) are decoded with args; everything
 * else is reported honestly as `Other` rather than guessed at.
 */
export function decodeSystemInstruction(data: Buffer): SystemInstruction {
  if (data.length < 4) {
    throw new SystemDecodeError(`system instruction truncated: need >= 4 bytes for the index, have ${data.length}`);
  }
  const index = data.readUInt32LE(0);
  switch (index) {
    case 0:
      return { index: 0, type: 'CreateAccount' };
    case 1:
      return { index: 1, type: 'Assign' };
    case 2: {
      if (data.length < 12) throw new SystemDecodeError(`Transfer: need >= 12 bytes, have ${data.length}`);
      return { index: 2, type: 'Transfer', lamports: data.readBigUInt64LE(4) };
    }
    case 3:
      return { index: 3, type: 'CreateAccountWithSeed' };
    case 4:
      return { index: 4, type: 'AdvanceNonceAccount' };
    case 5: {
      if (data.length < 12) throw new SystemDecodeError(`WithdrawNonceAccount: need >= 12 bytes, have ${data.length}`);
      return { index: 5, type: 'WithdrawNonceAccount', lamports: data.readBigUInt64LE(4) };
    }
    case 6: {
      if (data.length < 36) throw new SystemDecodeError(`InitializeNonceAccount: need >= 36 bytes, have ${data.length}`);
      return { index: 6, type: 'InitializeNonceAccount', authorized: bs58.encode(data.subarray(4, 36)) };
    }
    case 7: {
      if (data.length < 36) throw new SystemDecodeError(`AuthorizeNonceAccount: need >= 36 bytes, have ${data.length}`);
      return { index: 7, type: 'AuthorizeNonceAccount', newAuthorized: bs58.encode(data.subarray(4, 36)) };
    }
    default:
      return { index, type: 'Other' };
  }
}
