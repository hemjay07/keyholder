import { describe, expect, it } from 'vitest';
import { buildSignerIndex } from './signers';
import type { ProgramRecord } from './build';

const ms = (address: string, threshold: number, keys: string[], timelockS = 0) => ({ address, threshold, members: keys.length, memberKeys: keys, timelockS, version: 'v4' as const });
const rec = (programId: string, upgradeMs: ReturnType<typeof ms> | null, adminMs: ReturnType<typeof ms> | null, stage: 0 | 1 | 2 | 3, usd: number | null): ProgramRecord => ({
  programId, repo: null, usdFloor: usd,
  upgrade: { authority: null, kind: upgradeMs ? 'squads_vault' : 'single_key', multisig: upgradeMs, timelockCarried: false },
  admin: { status: 'read', undecoded: [], programWide: adminMs ? [{ account: 'GlobalConfig', field: 'admin', key: 'V', resolvedAs: 'multisig v4', multisig: adminMs }] : [], perInstance: [] },
  stage: { programId, rulesVersion: 'stages/v1', stage, bindingPath: 'upgrade', paths: [], modifiers: [], cap: null },
});

// Kamino-shaped: the main program and a side program share 9 of 10 signers through different multisigs.
const K = Array.from({ length: 10 }, (_, i) => `k${i}`);
const main = ms('MAIN', 5, K, 86400); const side = ms('SIDE', 1, [...K.slice(0, 9), 'other']); const admin = ms('ADMIN', 4, K, 43200);
const records = [rec('KLend', main, admin, 1, 1_484_000_000), rec('CanarFx', side, null, 0, 10_000), rec('Lone', ms('LONE', 2, ['x', 'y']), null, 1, 5)];

describe('buildSignerIndex', () => {
  const idx = buildSignerIndex(records);
  it('every member key of every controlling multisig is a signer, with the programs it can reach and through which path', () => {
    const k0 = idx.signers.find((s) => s.key === 'k0')!;
    expect(k0.multisigs.map((m) => m.address).sort()).toEqual(['ADMIN', 'MAIN', 'SIDE']);
    expect(k0.programs.map((p) => `${p.programId}:${p.path}`).sort()).toEqual(['CanarFx:upgrade', 'KLend:admin:GlobalConfig.admin', 'KLend:upgrade']);
  });
  it('usd behind a key counts each program once; worst stage is the weakest program it reaches', () => {
    const k0 = idx.signers.find((s) => s.key === 'k0')!;
    expect(k0.usdBehind).toBe(1_484_010_000);
    expect(k0.worstStage).toBe(0);
    expect(idx.signers[0]!.usdBehind).toBeGreaterThanOrEqual(idx.signers[idx.signers.length - 1]!.usdBehind);
  });
  it('overlaps need 2+ shared signers; contagion links programs both ways and keeps the strongest link', () => {
    expect(idx.overlaps.find((o) => [o.a, o.b].sort().join() === 'MAIN,SIDE')!.shared).toHaveLength(9);
    expect(idx.overlaps.some((o) => o.a === 'LONE' || o.b === 'LONE')).toBe(false);
    expect(idx.contagion['KLend']!.find((c) => c.programId === 'CanarFx')!.sharedSigners).toBe(9);
    expect(idx.contagion['CanarFx']![0]!.programId).toBe('KLend');
    expect(idx.contagion['Lone']).toBeUndefined();
  });
});
