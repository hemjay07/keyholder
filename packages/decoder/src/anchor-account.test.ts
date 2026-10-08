import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeAnchorAccount, anchorAccountDef, IdlTypeError } from './anchor-decoder';

const fx = (f: string) => JSON.parse(readFileSync(join(__dirname, '..', 'test', 'fixtures', f), 'utf8'));
const idl = fx('jup-perps-idl.json');
const acc = fx('jup-perps-perpetuals-account.json');

describe('decodeAnchorAccount (real Jupiter Perps Perpetuals account, read 2026-10-08)', () => {
  it('reads admin, which sits after a variable-length vec (pools) and so has no fixed offset', () => {
    const d = decodeAnchorAccount(idl, 'Perpetuals', Buffer.from(acc.data, 'base64'));
    expect(Array.isArray(d.pools)).toBe(true);
    expect(typeof d.admin).toBe('string');
    expect((d.admin as string).length).toBeGreaterThanOrEqual(32);
  });
  it('error: an unknown account name is refused, not guessed', () => {
    expect(anchorAccountDef(idl, 'NoSuchAccount')).toBeNull();
    expect(() => decodeAnchorAccount(idl, 'NoSuchAccount', Buffer.alloc(16))).toThrow(IdlTypeError);
  });
  it('error: truncated data throws instead of returning partial fields', () => {
    expect(() => decodeAnchorAccount(idl, 'Perpetuals', Buffer.from(acc.data, 'base64').subarray(0, 20))).toThrow(IdlTypeError);
  });
});
