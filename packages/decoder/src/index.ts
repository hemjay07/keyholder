// File: packages/decoder/src/index.ts
// Purpose: Main export surface for the decoder package
// [VERIFIED] — Aggregates all sub-decoders

// Re-export types
export * from './types';

// Re-export decoders
export * from './loader';
export * from './squads';
export * from './system';
export * from './idl';
export * from './privilege';

import { DecodedInstruction, UndecodeError, ParsedIdl } from './types';
import { decodeLoaderInstruction } from './loader';
import { decodeSquadsV4Instruction, decodeSquadsV3Instruction } from './squads';
import { decodeSystemInstruction } from './system';
import { decodeInstructionWithIdl, decodeSplGovernanceInstruction } from './idl';
import { classifyPrivilege } from './privilege';

/**
 * Main instruction decoder dispatcher
 * [VERIFIED] — Routes to appropriate decoder based on program ID
 *
 * Decoding strategy:
 * 1. Check if program is a well-known program (Loader, Squads, System, etc.)
 * 2. If yes, use specialized decoder
 * 3. If no, attempt IDL-based decoding
 * 4. If no IDL available, return null for undecoded
 */
export function decodeInstruction(
  programId: string,
  data: Buffer,
  accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>,
  options?: {
    idl?: ParsedIdl;
    knownAuthorities?: Set<string>;
  }
): DecodedInstruction | null {
  // BPF Upgradeable Loader
  if (programId === 'BPFLoaderUpgradeab1e11111111111111111111111') {
    return decodeLoaderInstruction(data, accounts);
  }

  // Squads v4
  if (programId === 'SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf') {
    const decoded = decodeSquadsV4Instruction(data, accounts);
    if (decoded && options?.knownAuthorities) {
      classifyPrivilege(decoded, options.knownAuthorities);
    }
    return decoded;
  }

  // Squads v3
  if (programId === 'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu') {
    const decoded = decodeSquadsV3Instruction(data, accounts);
    if (decoded && options?.knownAuthorities) {
      classifyPrivilege(decoded, options.knownAuthorities);
    }
    return decoded;
  }

  // System Program (nonce instructions only)
  if (programId === '11111111111111111111111111111111') {
    return decodeSystemInstruction(data, accounts);
  }

  // SPL Governance
  if (programId === 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw') {
    return decodeSplGovernanceInstruction(data, accounts);
  }

  // Generic IDL-based decoding
  if (options?.idl) {
    const decoded = decodeInstructionWithIdl(programId, options.idl, data, accounts);
    if (decoded && options?.knownAuthorities) {
      classifyPrivilege(decoded, options.knownAuthorities);
    }
    return decoded;
  }

  // No decoder available
  return null;
}

/**
 * Batch decode multiple instructions from a transaction
 * [VERIFIED] — Convenience function for decoding all instructions in a tx
 */
export function batchDecode(
  instructions: Array<{
    programId: string;
    data: Buffer;
    accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
  }>,
  options?: { idl?: Record<string, ParsedIdl>; knownAuthorities?: Set<string> }
): (DecodedInstruction | null)[] {
  return instructions.map((ix) => {
    const idl = options?.idl?.[ix.programId];
    return decodeInstruction(ix.programId, ix.data, ix.accounts, {
      idl,
      knownAuthorities: options?.knownAuthorities,
    });
  });
}
