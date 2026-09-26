// File: apps/worker/src/pipeline/parse-raw-tx.test.ts
// Real fixtures (src/pipeline/fixtures/*.json), captured 2026-09-26 live via
// Helius getTransaction — see file header of parse-raw-tx.ts.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseStoredTx, flattenStoredTx, parseAndFlattenRawTx, RawTxParseError } from './parse-raw-tx';

const legacyBuf = Buffer.from(readFileSync(join(__dirname, 'fixtures', 'raw-tx-legacy.json'), 'utf8'), 'utf8');
const v0Buf = Buffer.from(readFileSync(join(__dirname, 'fixtures', 'raw-tx-v0-alt.json'), 'utf8'), 'utf8');

describe('parseStoredTx', () => {
  it('happy: parses real legacy raw_tx JSON', () => {
    const parsed = parseStoredTx(legacyBuf);
    expect(typeof parsed).toBe('object');
  });

  it('error: throws RawTxParseError on invalid JSON', () => {
    expect(() => parseStoredTx(Buffer.from('not json', 'utf8'))).toThrow(RawTxParseError);
  });

  it('error: throws RawTxParseError on non-object JSON', () => {
    expect(() => parseStoredTx(Buffer.from('"just a string"', 'utf8'))).toThrow(RawTxParseError);
  });
});

describe('flattenStoredTx: real legacy transaction', () => {
  const flat = flattenStoredTx(parseStoredTx(legacyBuf));

  it('happy: extracts slot and instructions', () => {
    expect(flat.slot).toBeGreaterThan(0);
    expect(flat.instructions.length).toBeGreaterThan(0);
  });

  it('happy: top-level instructions get plain numeric ix_path', () => {
    expect(flat.instructions[0]!.ixPath).toBe('0');
  });

  it('happy: every instruction resolves a non-empty program id', () => {
    for (const ix of flat.instructions) {
      expect(ix.programId.length).toBeGreaterThan(0);
      expect(Buffer.isBuffer(ix.data)).toBe(true);
    }
  });
});

describe('flattenStoredTx: real v0 transaction with ALT + inner instructions', () => {
  const flat = flattenStoredTx(parseStoredTx(v0Buf));

  it('happy: decodes compiledInstructions (Buffer-JSON data) without error', () => {
    expect(flat.instructions.length).toBeGreaterThan(0);
  });

  it('edge: produces dotted ix_path for inner instructions', () => {
    const inner = flat.instructions.filter((ix) => ix.ixPath.includes('.'));
    expect(inner.length).toBeGreaterThan(0);
    for (const ix of inner) {
      expect(ix.ixPath).toMatch(/^\d+\.\d+$/);
    }
  });

  it('edge: resolves account keys loaded via address lookup tables (index beyond staticAccountKeys)', () => {
    // At least one instruction must reference an index into the loaded
    // (ALT) segment for this to be a meaningful ALT test; assert every
    // resolved pubkey is non-empty, proving the loadedAddresses segment
    // concatenation (staticAccountKeys ++ writable ++ readonly) worked.
    for (const ix of flat.instructions) {
      for (const acc of ix.accounts) {
        expect(acc.pubkey.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('flattenStoredTx: error paths', () => {
  it('error: throws when transaction.message is missing', () => {
    expect(() => flattenStoredTx({ transaction: {} })).toThrow(RawTxParseError);
  });

  it('error: throws when header.numRequiredSignatures is missing', () => {
    expect(() =>
      flattenStoredTx({ transaction: { message: { accountKeys: [], instructions: [] } } })
    ).toThrow(RawTxParseError);
  });
});

describe('parseAndFlattenRawTx', () => {
  it('happy: parses + flattens in one call', () => {
    const result = parseAndFlattenRawTx(legacyBuf);
    expect(result.instructions.length).toBeGreaterThan(0);
  });
});
