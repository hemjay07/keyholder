import { describe, expect, it } from 'vitest';
import { computeStage, pathStage, RULES_VERSION, DAY_S, type ControlPath, type ProgramFacts } from './stages';

const ms = (threshold: number, members: number, timelockS: number | null, path = 'upgrade'): ControlPath => ({ path, kind: 'multisig', address: 'M', threshold, members, timelockS, version: 'v4' });
const facts = (upgrade: ControlPath, over: Partial<ProgramFacts> = {}): ProgramFacts => ({ programId: 'P', upgrade, admin: [], adminStatus: 'read', ...over });

describe('pathStage: each rule edge', () => {
  it('immutable is Stage 3', () => expect(pathStage({ path: 'upgrade', kind: 'immutable' }).stage).toBe(3));
  it('a single key is Stage 0', () => expect(pathStage({ path: 'upgrade', kind: 'single_key', key: 'K' }).stage).toBe(0));
  it('an unresolved controller is Stage 0', () => expect(pathStage({ path: 'upgrade', kind: 'unresolved', key: 'K' }).stage).toBe(0));
  it('a 1-of-n multisig is Stage 0 (any one member acts alone)', () => {
    const v = pathStage(ms(1, 10, 0));
    expect(v.stage).toBe(0);
    expect(v.reason).toContain('1 of 10');
  });
  it('2-of-n, no timelock is Stage 1; null timelock (v3/coral) counts as none', () => {
    expect(pathStage(ms(2, 3, 0)).stage).toBe(1);
    expect(pathStage(ms(4, 7, null)).reason).toBe('4 of 7, no timelock');
  });
  it('a timelock just under 24 h is still Stage 1; exactly 24 h is Stage 2', () => {
    expect(pathStage(ms(5, 10, DAY_S - 1)).stage).toBe(1);
    expect(pathStage(ms(5, 10, DAY_S)).stage).toBe(2);
    expect(pathStage(ms(4, 10, 43_200)).reason).toBe('4 of 10, 12 h timelock (under 24 h)');
  });
  it('a timelock just under 7 d is Stage 2; exactly 7 d is Stage 3', () => {
    expect(pathStage(ms(3, 5, 7 * DAY_S - 1)).stage).toBe(2);
    expect(pathStage(ms(3, 5, 7 * DAY_S)).stage).toBe(3);
  });
  it('governance follows the same delay bands as a multisig timelock', () => {
    const g = (holdUpS: number | null): ControlPath => ({ path: 'upgrade', kind: 'governance', address: 'G', holdUpS });
    expect(pathStage(g(null)).stage).toBe(1);
    expect(pathStage(g(DAY_S)).stage).toBe(2);
    expect(pathStage(g(7 * DAY_S)).stage).toBe(3);
  });
});

describe('computeStage: the weakest path sets the stage', () => {
  it('an upgrade at Stage 2 with a single-key admin field is Stage 0, bound by the admin field', () => {
    const r = computeStage(facts(ms(5, 10, DAY_S), { admin: [{ path: 'admin:GlobalConfig.admin', kind: 'single_key', key: 'K' }] }));
    expect(r.stage).toBe(0);
    expect(r.bindingPath).toBe('admin:GlobalConfig.admin');
    expect(r.paths).toHaveLength(2);
  });
  it('Kamino-shaped: upgrade 5/10 24 h, admin 4/10 12 h -> Stage 1, bound by the admin multisig', () => {
    const r = computeStage(facts(ms(5, 10, DAY_S), { admin: [ms(4, 10, 43_200, 'admin:GlobalConfig.globalAdmin')] }));
    expect(r.stage).toBe(1);
    expect(r.bindingPath).toBe('admin:GlobalConfig.globalAdmin');
  });
  it('Raydium-shaped: 3/4 no timelock, admin not read -> Stage 1 with admin_unknown, no cap needed', () => {
    const r = computeStage(facts(ms(3, 4, 0), { adminStatus: 'unknown' }));
    expect(r.stage).toBe(1);
    expect(r.modifiers).toContain('admin_unknown');
    expect(r.cap).toBeNull();
  });
  it('unread admin caps a Stage 2 upgrade at Stage 1, and says why', () => {
    const r = computeStage(facts(ms(5, 10, DAY_S), { adminStatus: 'unknown' }));
    expect(r.stage).toBe(1);
    expect(r.bindingPath).toBe('cap:admin_unknown');
    expect(r.cap?.reason).toMatch(/admin fields not read/);
  });
  it('immutable code with unread admin config is capped at 1: config can still move funds', () => {
    const r = computeStage(facts({ path: 'upgrade', kind: 'immutable' }, { adminStatus: 'unknown' }));
    expect(r.stage).toBe(1);
    expect(r.paths[0]!.stage).toBe(3);
  });
  it('immutable with admin read and no admin fields is Stage 3', () => {
    expect(computeStage(facts({ path: 'upgrade', kind: 'immutable' })).stage).toBe(3);
  });
  it('an unresolved admin key caps at 1 (not 0) and is flagged', () => {
    const r = computeStage(facts(ms(5, 10, DAY_S), { admin: [{ path: 'admin:GlobalConfig.globalAdmin', kind: 'unresolved', key: 'PDA' }] }));
    expect(r.stage).toBe(1);
    expect(r.modifiers).toContain('admin_unresolved');
  });
  it('an unresolved upgrade authority is Stage 0 and flagged', () => {
    const r = computeStage(facts({ path: 'upgrade', kind: 'unresolved', key: 'K' }));
    expect(r.stage).toBe(0);
    expect(r.modifiers).toContain('upgrade_unresolved');
  });
  it('closed programs keep their last stage and carry the closed modifier', () => {
    expect(computeStage(facts({ path: 'upgrade', kind: 'single_key', key: 'K' }, { closed: true })).modifiers).toContain('closed');
  });
  it('deterministic and versioned', () => {
    const f = facts(ms(3, 4, 0));
    expect(computeStage(f)).toEqual(computeStage(f));
    expect(computeStage(f).rulesVersion).toBe(RULES_VERSION);
  });
});
