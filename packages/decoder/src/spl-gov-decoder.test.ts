import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import bs58 from 'bs58';
import { decodeInsertTransaction, classifyProposal, SPL_GOVERNANCE_PROGRAM_ID, SplGovDecodeError } from './spl-gov-decoder';

function govIxData(file: string): Buffer {
  const t = JSON.parse(readFileSync(join(__dirname, '..', 'test', 'fixtures', file), 'utf8'));
  const keys: string[] = t.transaction.message.accountKeys;
  const ix = t.transaction.message.instructions.find((i: { programIdIndex: number; data: string }) => keys[i.programIdIndex] === SPL_GOVERNANCE_PROGRAM_ID && bs58.decode(i.data)[0] === 9);
  return Buffer.from(bs58.decode(ix.data));
}

describe('spl-governance InsertTransaction (real mainnet txs)', () => {
  it('happy: Synthetify 2023 attack proposal inserts a program upgrade with a 24 h hold-up', () => {
    const d = decodeInsertTransaction(govIxData('spl-gov-insert-upgrade-synthetify.json'));
    expect(d.holdUpTimeS).toBe(86400);
    expect(d.instructions).toHaveLength(1);
    expect(d.instructions[0]!.programId).toBe('BPFLoaderUpgradeab1e11111111111111111111111');
    expect(d.instructions[0]!.accounts).toHaveLength(7);
    expect(classifyProposal(d)).toBe('program_upgrade');
  });
  it('happy: BonkDAO BIP #76 inserts a token TransferChecked (treasury move)', () => {
    const d = decodeInsertTransaction(govIxData('spl-gov-insert-transfer-bonkdao.json'));
    expect(d.index).toBe(3);
    expect(d.instructions[0]!.programId).toBe('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    expect(classifyProposal(d)).toBe('treasury_transfer');
  });
  it('edge: a proposal with an unrelated instruction touches nothing', () => {
    expect(classifyProposal({ optionIndex: 0, index: 0, holdUpTimeS: 0, instructions: [{ programId: 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo', accounts: [], data: Buffer.from('hi') }] })).toBe('none');
  });
  it('error: wrong discriminator or truncated data throws', () => {
    expect(() => decodeInsertTransaction(Buffer.from([12]))).toThrow(SplGovDecodeError);
    expect(() => decodeInsertTransaction(govIxData('spl-gov-insert-upgrade-synthetify.json').subarray(0, 50))).toThrow(/truncated/);
  });
});
