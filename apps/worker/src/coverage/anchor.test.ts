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
    expect(parseMemo(`[${memoText('2026-10-03', 448, h).length}] ${memoText('2026-10-03', 448, h)}`)).toEqual({ day: '2026-10-03', count: 448, hash: h });
  });
  it('error: rejects other memos', () => { expect(parseMemo('hello')).toBeNull(); });
});
