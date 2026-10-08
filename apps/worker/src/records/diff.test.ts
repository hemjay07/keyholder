import { describe, expect, it } from 'vitest';
import { diffRecords } from './diff';
import type { ProgramRecord } from './build';

const base = (over: Partial<ProgramRecord> & { stage?: number; mods?: string[] } = {}): ProgramRecord => {
  const { stage = 1, mods = [], ...rest } = over;
  return {
    programId: 'P', repo: null, usdFloor: null,
    upgrade: { authority: 'V', kind: 'squads_vault', multisig: { address: 'M', threshold: 3, members: 4, memberKeys: ['a', 'b', 'c', 'd'], timelockS: 0, version: 'v4' }, timelockCarried: false },
    admin: { status: 'read', undecoded: [], programWide: [], perInstance: [] },
    stage: { programId: 'P', rulesVersion: 'stages/v1', stage: stage as 0, bindingPath: 'upgrade', paths: [{ path: 'upgrade', stage: stage as 0, reason: '' }], modifiers: mods as never, cap: null },
    ...rest,
  };
};
const ms = (o: object) => ({ upgrade: { ...base().upgrade, multisig: { ...base().upgrade.multisig!, ...o } } });

describe('diffRecords', () => {
  it('no change, no events', () => expect(diffRecords('d', [base()], [base()])).toEqual([]));
  it('Drift-shaped: timelock removed -> timelock_changed and stage_changed with its cause', () => {
    const before = base({ ...ms({ timelockS: 86400 }), stage: 2 });
    const after = base({ stage: 1 });
    const ev = diffRecords('2026-03-27', [before], [after]);
    expect(ev.map((e) => e.kind)).toEqual(['timelock_changed', 'stage_changed']);
    expect(ev[1]).toMatchObject({ from: 2, to: 1, path: 'upgrade' });
  });
  it('threshold lowered and a member swapped, in the same multisig', () => {
    const ev = diffRecords('d', [base()], [base(ms({ threshold: 2, memberKeys: ['a', 'b', 'c', 'e'] }))]);
    expect(ev.find((e) => e.kind === 'threshold_changed')).toMatchObject({ from: '3 of 4', to: '2 of 4' });
    expect(ev.find((e) => e.kind === 'members_changed')).toMatchObject({ added: ['e'], removed: ['d'] });
  });
  it('a different multisig is multisig_replaced, not a threshold change; authority change is reported', () => {
    const after = base({ upgrade: { ...base().upgrade, authority: 'V2', multisig: { ...base().upgrade.multisig!, address: 'N', threshold: 2 } } });
    const kinds = diffRecords('d', [base()], [after]).map((e) => e.kind);
    expect(kinds).toEqual(['authority_changed', 'multisig_replaced']);
  });
  it('a timelock carried back from a later day never produces a timelock event', () => {
    const before = base({ upgrade: { ...ms({ timelockS: 86400 }).upgrade, timelockCarried: true } });
    expect(diffRecords('d', [before], [base()]).some((e) => e.kind === 'timelock_changed')).toBe(false);
  });
  it('closure and admin key change are events; programs entering or leaving coverage are not (bookkeeping)', () => {
    const adm = (key: string) => ({ admin: { ...base().admin, programWide: [{ account: 'GlobalConfig', field: 'admin', key, resolvedAs: 'single_key', multisig: null }] } });
    const ev = diffRecords('d', [base(adm('K1')), base({ programId: 'GONE' })], [base({ ...adm('K2'), mods: ['closed'] }), base({ programId: 'NEW' })]);
    expect(ev.map((e) => `${e.programId}:${e.kind}`)).toEqual(['P:program_closed', 'P:admin_changed']); // spec change 2026-10-08: coverage changes are not feed events
  });
});

describe('closures missed by the old log', () => {
  it('a program absent the day before and closed today is reported closed', () => {
    const ev = diffRecords('2026-10-08', [], [base({ mods: ['closed'] })]);
    expect(ev.map((e) => e.kind)).toEqual(['program_closed']);
  });
});
