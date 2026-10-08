import { describe, expect, it } from 'vitest';
import { canonical, digest, memoText, parseMemo, type DailyRow } from './anchor';

const row = (id: string, over: Partial<DailyRow> = {}): DailyRow => ({ day: '2026-10-03', program_id: id, slot: 1, upgrade_authority: 'A', authority_kind: 'single_key', multisig: null, threshold: null, members: null, ...over });

describe('digest', () => {
  it('happy: same rows in any order give the same hash', () => {
    expect(digest([row('B'), row('A')])).toBe(digest([row('A'), row('B')]));
  });
  it('happy: member order does not change the hash', () => {
    expect(digest([row('A', { members: ['y', 'x'] })])).toBe(digest([row('A', { members: ['x', 'y'] })]));
  });
  it('error: any observed field changing changes the hash', () => {
    const base = digest([row('A', { threshold: 5, multisig: 'M', members: ['x'] })]);
    for (const over of [{ threshold: 1 }, { multisig: 'N' }, { members: ['z'] }, { upgrade_authority: 'B' }, { authority_kind: 'immutable' }, { slot: 2 }] as Partial<DailyRow>[]) {
      expect(digest([row('A', { threshold: 5, multisig: 'M', members: ['x'], ...over })])).not.toBe(base);
    }
  });
  it('edge: a dropped row changes the hash; empty day is a fixed hash', () => {
    expect(digest([row('A')])).not.toBe(digest([row('A'), row('B')]));
    expect(canonical([])).toBe('');
  });
  it('happy: slot stored as string (bigint from pg) hashes the same as number', () => {
    expect(digest([row('A', { slot: '7' as unknown as number })])).toBe(digest([row('A', { slot: 7 })]));
  });
});

describe('memo', () => {
  it('round-trips', () => {
    const h = 'a'.repeat(64);
    expect(parseMemo(`[${memoText('2026-10-03', 448, h).length}] ${memoText('2026-10-03', 448, h)}`)).toEqual({ version: 'v2', day: '2026-10-03', count: 448, hash: h }); // spec change 2026-10-08: memos carry their canonical version
  });
  it('error: rejects other memos', () => { expect(parseMemo('hello')).toBeNull(); });
});

describe('canonical versions', () => {
  const r = { day: '2026-10-08', program_id: 'A', slot: 1, upgrade_authority: 'U', authority_kind: 'squads_vault', multisig: 'M', threshold: 3, members: ['x', 'y', 'z'] } as const;
  it('v1 ignores v2 fields: a row read back with timelock columns hashes as it did when anchored', () => {
    expect(digest([{ ...r, timelock_s: 86400, ms_version: 'v4' }], 'v1')).toBe(digest([{ ...r }], 'v1'));
  });
  it('v2 includes the timelock: changing it changes the hash; v2 differs from v1', () => {
    const a = digest([{ ...r, timelock_s: 0, ms_version: 'v4' }], 'v2');
    expect(digest([{ ...r, timelock_s: 86400, ms_version: 'v4' }], 'v2')).not.toBe(a);
    expect(digest([{ ...r, timelock_s: 0, ms_version: 'v4' }], 'v1')).not.toBe(a);
  });
  it('memos carry their version and parse both', () => {
    const h = 'b'.repeat(64);
    expect(parseMemo(memoText('2026-10-08', 3, h, 'v1'))?.version).toBe('v1');
    expect(parseMemo(memoText('2026-10-08', 3, h))?.version).toBe('v2');
  });
});
