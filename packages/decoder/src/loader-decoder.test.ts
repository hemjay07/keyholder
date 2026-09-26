// File: packages/decoder/src/loader-decoder.test.ts
// Real fixtures from Drift's actual program upgrade (slot 429,731,225) and
// its preceding buffer writes (fetched 2026-09-26; see
// scripts/tmp-fetch-all-fixtures.ts).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeBpfLoaderInstruction, upgradeAccounts, LoaderDecodeError } from './loader-decoder';

interface IxFixture {
  data_hex: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
}

function loadFixture(name: string): IxFixture {
  const raw = readFileSync(join(__dirname, '..', 'test', 'fixtures', `ix-${name}.json`), 'utf-8');
  return JSON.parse(raw) as IxFixture;
}

describe('decodeBpfLoaderInstruction — real instructions', () => {
  it('decodes the real Upgrade instruction from Drift\'s slot-429,731,225 deploy', () => {
    const fx = loadFixture('loader-upgrade');
    const decoded = decodeBpfLoaderInstruction(Buffer.from(fx.data_hex, 'hex'));
    expect(decoded).toEqual({ tag: 3, type: 'Upgrade' });
  });

  it('decodes the real SetAuthority instruction that created the upgrade buffer', () => {
    const fx = loadFixture('loader-set-authority');
    const decoded = decodeBpfLoaderInstruction(Buffer.from(fx.data_hex, 'hex'));
    expect(decoded).toEqual({ tag: 4, type: 'SetAuthority' });
  });

  it('decodes a real Write instruction, including the u64 (not u32) Vec<u8> length prefix', () => {
    const fx = loadFixture('loader-write');
    const decoded = decodeBpfLoaderInstruction(Buffer.from(fx.data_hex, 'hex'));
    expect(decoded.type).toBe('Write');
    if (decoded.type !== 'Write') throw new Error('unreachable');
    expect(decoded.offset).toBe(0x0002ea40);
    expect(decoded.bytes.length).toBe(960);
  });
});

describe('decodeBpfLoaderInstruction — tags 0, 2, 5, 6, 7 (designed from published source, DEV-008 UNTESTED against a real tx)', () => {
  it('decodes InitializeBuffer (tag 0, no args)', () => {
    expect(decodeBpfLoaderInstruction(Buffer.from([0, 0, 0, 0]))).toEqual({ tag: 0, type: 'InitializeBuffer' });
  });

  it('decodes DeployWithMaxDataLen (tag 2, u64 max_data_len)', () => {
    const buf = Buffer.alloc(12);
    buf.writeUInt32LE(2, 0);
    buf.writeBigUInt64LE(123456n, 4);
    expect(decodeBpfLoaderInstruction(buf)).toEqual({ tag: 2, type: 'DeployWithMaxDataLen', maxDataLen: 123456n });
  });

  it('decodes Close (tag 5, no args)', () => {
    expect(decodeBpfLoaderInstruction(Buffer.from([5, 0, 0, 0]))).toEqual({ tag: 5, type: 'Close' });
  });

  it('decodes ExtendProgram (tag 6, u32 additional_bytes)', () => {
    const buf = Buffer.alloc(8);
    buf.writeUInt32LE(6, 0);
    buf.writeUInt32LE(4096, 4);
    expect(decodeBpfLoaderInstruction(buf)).toEqual({ tag: 6, type: 'ExtendProgram', additionalBytes: 4096 });
  });

  it('decodes SetAuthorityChecked (tag 7, no args)', () => {
    expect(decodeBpfLoaderInstruction(Buffer.from([7, 0, 0, 0]))).toEqual({ tag: 7, type: 'SetAuthorityChecked' });
  });
});

describe('decodeBpfLoaderInstruction — error cases', () => {
  it('rejects a buffer too short to hold a u32 tag', () => {
    expect(() => decodeBpfLoaderInstruction(Buffer.alloc(2))).toThrow(LoaderDecodeError);
  });

  it('rejects an unknown tag', () => {
    expect(() => decodeBpfLoaderInstruction(Buffer.from([99, 0, 0, 0]))).toThrow(LoaderDecodeError);
  });

  it('rejects a Write instruction whose declared byte length exceeds the buffer', () => {
    const buf = Buffer.alloc(16);
    buf.writeUInt32LE(1, 0);
    buf.writeUInt32LE(0, 4);
    buf.writeBigUInt64LE(999n, 8); // claims 999 bytes follow, but none do
    expect(() => decodeBpfLoaderInstruction(buf)).toThrow(LoaderDecodeError);
  });
});

describe('upgradeAccounts', () => {
  it('extracts the real program/programData/buffer/authority from the Upgrade fixture account order', () => {
    const fx = loadFixture('loader-upgrade');
    const accounts = upgradeAccounts(fx.accounts.map((a) => a.pubkey));
    expect(accounts.programData).toBe('7dLgmtcTavcguNoynVimF9ZNVb13FvhXVRfj2HyrDGaP');
    expect(accounts.program).toBe('dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH');
    expect(accounts.upgradeAuthority).toBe('8jj7zJgdr5bDndc7evM74FMGwzLPmd4u4QxNzFi1BMai');
  });

  it('rejects an account list shorter than the 7 accounts Upgrade requires', () => {
    expect(() => upgradeAccounts(['a', 'b'])).toThrow(LoaderDecodeError);
  });
});
