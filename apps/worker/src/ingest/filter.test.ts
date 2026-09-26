import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { filterInstruction, shouldKeepCandidate, SYSTEM_PROGRAM_ID, SPL_GOVERNANCE_PROGRAM_ID } from './filter';
import { BPF_LOADER_UPGRADEABLE_PROGRAM_ID, SQUADS_V4_PROGRAM_ID } from '@keyholder/decoder';
import type { IngestCandidate, RawInstruction } from './types';

function loaderIx(tag: number, extra: Buffer = Buffer.alloc(0)): RawInstruction {
  const data = Buffer.concat([Buffer.alloc(4), extra]);
  data.writeUInt32LE(tag, 0);
  return { programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID, data, accounts: [] };
}

function anchorDisc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}

const baseConfig = { trackedProgramIds: new Set<string>(), watchedSigners: new Set<string>() };

describe('filterInstruction: BPF Upgradeable Loader', () => {
  it('drops Write (tag 1) — the >98% traffic case', () => {
    const verdict = filterInstruction(loaderIx(1), baseConfig);
    expect(verdict.keep).toBe(false);
  });

  it('drops InitializeBuffer (tag 0)', () => {
    expect(filterInstruction(loaderIx(0), baseConfig).keep).toBe(false);
  });

  it.each([2, 3, 4, 5, 6, 7])('keeps tag %i', (tag) => {
    expect(filterInstruction(loaderIx(tag), baseConfig).keep).toBe(true);
  });
});

describe('filterInstruction: Squads v4', () => {
  it('keeps vaultTransactionExecute', () => {
    const ix: RawInstruction = { programId: SQUADS_V4_PROGRAM_ID, data: anchorDisc('vaultTransactionExecute'), accounts: [] };
    expect(filterInstruction(ix, baseConfig).keep).toBe(true);
  });

  it('keeps configTransactionCreate', () => {
    const ix: RawInstruction = { programId: SQUADS_V4_PROGRAM_ID, data: anchorDisc('configTransactionCreate'), accounts: [] };
    expect(filterInstruction(ix, baseConfig).keep).toBe(true);
  });

  it('keeps an unrecognized Squads discriminator conservatively', () => {
    const ix: RawInstruction = { programId: SQUADS_V4_PROGRAM_ID, data: Buffer.alloc(8, 0xff), accounts: [] };
    expect(filterInstruction(ix, baseConfig).keep).toBe(true);
  });
});

describe('filterInstruction: SPL Governance', () => {
  it('keeps any instruction from the governance program', () => {
    const ix: RawInstruction = { programId: SPL_GOVERNANCE_PROGRAM_ID, data: Buffer.from([1, 2, 3]), accounts: [] };
    expect(filterInstruction(ix, baseConfig).keep).toBe(true);
  });
});

describe('filterInstruction: System Program nonce', () => {
  const nonceIx = (index: number, accounts: string[]): RawInstruction => {
    const data = Buffer.alloc(4);
    data.writeUInt32LE(index, 0);
    return { programId: SYSTEM_PROGRAM_ID, data, accounts: accounts.map((pubkey) => ({ pubkey, isSigner: false })) };
  };

  it('drops nonce ix when signer is not watched', () => {
    const config = { ...baseConfig, watchedSigners: new Set(['someone-else']) };
    expect(filterInstruction(nonceIx(6, ['unwatched']), config).keep).toBe(false);
  });

  it('keeps nonce ix when a watched signer is involved', () => {
    const config = { ...baseConfig, watchedSigners: new Set(['watched-key']) };
    expect(filterInstruction(nonceIx(6, ['watched-key']), config).keep).toBe(true);
  });

  it('drops non-nonce System Program instructions (e.g. Transfer, index 2)', () => {
    const config = { ...baseConfig, watchedSigners: new Set(['watched-key']) };
    expect(filterInstruction(nonceIx(2, ['watched-key']), config).keep).toBe(false);
  });
});

describe('filterInstruction: tracked protocol admin ix', () => {
  it('keeps instructions from a tracked program id', () => {
    const config = { ...baseConfig, trackedProgramIds: new Set(['dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH']) };
    const ix: RawInstruction = { programId: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH', data: Buffer.from([9]), accounts: [] };
    expect(filterInstruction(ix, config).keep).toBe(true);
  });

  it('drops instructions from an unwatched, untracked program', () => {
    const ix: RawInstruction = { programId: 'SomeRandomProgram11111111111111111111111', data: Buffer.from([9]), accounts: [] };
    expect(filterInstruction(ix, baseConfig).keep).toBe(false);
  });
});

describe('shouldKeepCandidate', () => {
  function candidateWith(instructions: RawInstruction[]): IngestCandidate {
    return {
      signature: 'sig',
      slot: 1,
      blockTime: null,
      commitment: 'confirmed',
      source: 'poller',
      instructions,
      raw: {},
    };
  }

  it('keeps a tx if ANY instruction should be kept, even if most are noise', () => {
    const candidate = candidateWith([loaderIx(1), loaderIx(1), loaderIx(3)]);
    expect(shouldKeepCandidate(candidate, baseConfig)).toBe(true);
  });

  it('drops a tx if every instruction is noise', () => {
    const candidate = candidateWith([loaderIx(1), loaderIx(0)]);
    expect(shouldKeepCandidate(candidate, baseConfig)).toBe(false);
  });
});
