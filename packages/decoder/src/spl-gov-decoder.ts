// File: packages/decoder/src/spl-gov-decoder.ts
// [TESTED — spl-gov-decoder.test.ts, on two real mainnet transactions]
//
// spl-governance InsertTransaction: what a proposal would do once it passes.
// Layout (borsh, verified on Synthetify 2023 and BonkDAO 2026 proposals):
//   u8 discriminator (9) · u8 option_index · u16 index · u32 hold_up_time ·
//   Vec<InstructionData { program_id: Pubkey, accounts: Vec<{ pubkey, is_signer, is_writable }>, data: Vec<u8> }>

import bs58 from 'bs58';
import { DecodeError } from './errors';

export class SplGovDecodeError extends DecodeError {}

export const SPL_GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
const BPF_LOADER = 'BPFLoaderUpgradeab1e11111111111111111111111';
const TOKEN_PROGRAMS = new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const INSERT_TRANSACTION = 9;

export interface GovInstruction { programId: string; accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[]; data: Buffer }
export interface InsertTransaction { optionIndex: number; index: number; holdUpTimeS: number; instructions: GovInstruction[] }
export type ProposalTouches = 'program_upgrade' | 'set_authority' | 'treasury_transfer' | 'none';

export function decodeInsertTransaction(data: Buffer): InsertTransaction {
  if (data[0] !== INSERT_TRANSACTION) throw new SplGovDecodeError(`not InsertTransaction (discriminator ${data[0]})`);
  let o = 1;
  const need = (n: number) => { if (o + n > data.length) throw new SplGovDecodeError(`truncated at ${o}+${n} of ${data.length}`); };
  need(7);
  const optionIndex = data.readUInt8(o); o += 1;
  const index = data.readUInt16LE(o); o += 2;
  const holdUpTimeS = data.readUInt32LE(o); o += 4;
  need(4); const n = data.readUInt32LE(o); o += 4;
  const instructions: GovInstruction[] = [];
  for (let i = 0; i < n; i++) {
    need(36); const programId = bs58.encode(data.subarray(o, o + 32)); o += 32;
    const na = data.readUInt32LE(o); o += 4;
    const accounts = [];
    for (let j = 0; j < na; j++) { need(34); accounts.push({ pubkey: bs58.encode(data.subarray(o, o + 32)), isSigner: data[o + 32] === 1, isWritable: data[o + 33] === 1 }); o += 34; }
    need(4); const dl = data.readUInt32LE(o); o += 4;
    need(dl); instructions.push({ programId, accounts, data: Buffer.from(data.subarray(o, o + dl)) }); o += dl;
  }
  return { optionIndex, index, holdUpTimeS, instructions };
}

/** The most dangerous thing any inner instruction would do. Loader: 3 Upgrade, 4 SetAuthority, 7 SetAuthorityChecked. Token: 3 Transfer, 12 TransferChecked. */
export function classifyProposal(ins: InsertTransaction): ProposalTouches {
  let worst: ProposalTouches = 'none';
  for (const ix of ins.instructions) {
    const tag = ix.data.length >= 4 ? ix.data.readUInt32LE(0) : -1;
    if (ix.programId === BPF_LOADER && tag === 3) return 'program_upgrade';
    if (ix.programId === BPF_LOADER && (tag === 4 || tag === 7)) worst = 'set_authority';
    if (TOKEN_PROGRAMS.has(ix.programId) && (ix.data[0] === 3 || ix.data[0] === 12) && worst === 'none') worst = 'treasury_transfer';
  }
  return worst;
}
