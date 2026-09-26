// File: packages/decoder/src/squads-decoder.ts
// [TESTED against real mainnet Squads v4 instructions, 2026-09-26]
//
// Thin, typed wrapper over anchor-decoder.ts for Squads v4
// (SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf) instructions, plus CPI
// resolution for vault_transaction_execute (BACKEND.md §3: "resolve the
// inner CPI from the tx's innerInstructions"). The IDL itself (config
// transaction actions, proposal args, vault transaction args) is decoded
// generically by anchor-decoder.ts — this file only adds Squads-specific
// convenience types and the CPI-resolution helper.

import type { AnchorIdl, AnchorDecodeResult } from './anchor-decoder';
import { decodeAnchorInstruction } from './anchor-decoder';
import { SQUADS_V4_PROGRAM_ID } from './byte-parser';

/** Instruction names this task's real fixtures verified end-to-end. */
export const SQUADS_TESTED_INSTRUCTIONS = [
  'configTransactionCreate',
  'proposalCreate',
  'proposalActivate',
  'proposalApprove',
  'proposalReject',
  'proposalCancel',
  'vaultTransactionCreate',
  'vaultTransactionExecute',
] as const;

export function decodeSquadsInstruction(idl: AnchorIdl, data: Buffer): AnchorDecodeResult {
  return decodeAnchorInstruction(SQUADS_V4_PROGRAM_ID, idl, data);
}

export interface RawInnerInstruction {
  programId: string;
  data: Buffer;
  accounts: string[];
}

/**
 * A vault_transaction_execute instruction carries no useful data of its own
 * (see anchor-decoder.test.ts: args === {}) — everything about what the
 * vault actually did lives in the CPI(s) it triggers, recorded as inner
 * instructions on the transaction. This extracts them for the caller to
 * decode with whatever IDL matches `programId` (or leave undecoded if none
 * is known — this function makes no decoding decision itself).
 */
export function resolveVaultTransactionCpis(innerInstructions: RawInnerInstruction[]): RawInnerInstruction[] {
  return innerInstructions;
}

/**
 * Real Squads v4 config actions (Task 2.2 list). The generic decoder
 * already parses the ConfigAction enum from the IDL as
 * `{variant, fields}` — this just narrows and re-shapes it for callers
 * that don't want to hold onto the raw enum shape.
 */
export type ConfigActionVariant =
  | 'AddMember'
  | 'RemoveMember'
  | 'ChangeThreshold'
  | 'SetTimeLock'
  | 'SetRentCollector'
  | 'AddSpendingLimit'
  | 'RemoveSpendingLimit';

export interface DecodedConfigAction {
  variant: ConfigActionVariant;
  fields: Record<string, unknown>;
}

export interface DecodedConfigTransactionCreate {
  actions: DecodedConfigAction[];
  memo: string | null;
}

/**
 * Narrow a decoded configTransactionCreate instruction's args into the
 * typed shape above. Throws if the instruction wasn't actually
 * configTransactionCreate — callers should check `result.ix.name` first, or
 * just catch this the same way any other malformed-instruction path is
 * handled (this package never invents a fallback shape).
 */
export function asConfigTransactionCreate(result: AnchorDecodeResult): DecodedConfigTransactionCreate {
  if (result.kind !== 'decoded' || result.ix.name !== 'configTransactionCreate') {
    throw new Error('asConfigTransactionCreate: not a decoded configTransactionCreate instruction');
  }
  const inner = result.ix.args.args as { actions: DecodedConfigAction[]; memo: string | null };
  return { actions: inner.actions, memo: inner.memo };
}
