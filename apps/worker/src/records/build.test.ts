import { describe, expect, it } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { splitAdmin, upgradePath, adminPath, buildRecords, type DayRow, type AdminKey } from './build';

const offline = { getSignaturesForAddress: async () => [], getAccountInfo: async () => null } as never;
const row = (over: Partial<DayRow>): DayRow => ({ program_id: 'P', slot: 1, upgrade_authority: 'U', authority_kind: 'single_key', multisig: null, threshold: null, members: null, timelock_s: null, ms_version: null, ...over });
const key = (account: string, address: string, kind = 'single_key'): AdminKey => ({ account, address, field: 'admin', key: 'K' + address, kind });

describe('splitAdmin', () => {
  it('an account seen once is program-wide; an account with many instances is per-instance (markets, pools)', () => {
    const { programWide, perInstance } = splitAdmin([key('GlobalConfig', 'g'), key('LendingMarket', 'm1'), key('LendingMarket', 'm2')]);
    expect(programWide.map((k) => k.account)).toEqual(['GlobalConfig']);
    expect([...perInstance.keys()]).toEqual(['LendingMarket']);
  });
});

describe('path mapping', () => {
  it('maps every authority kind; a multisig with no read facts is unresolved, never assumed', () => {
    expect(upgradePath(row({ authority_kind: 'immutable' }), null).kind).toBe('immutable');
    expect(upgradePath(row({ authority_kind: 'single_key' }), null).kind).toBe('single_key');
    expect(upgradePath(row({ authority_kind: 'squads_vault', multisig: 'M' }), null).kind).toBe('unresolved');
    expect(upgradePath(row({ authority_kind: 'squads_vault', multisig: 'M' }), { address: 'M', threshold: 3, members: 4, timelockS: 0, version: 'v4' }).kind).toBe('multisig');
    expect(upgradePath(row({ authority_kind: 'spl_gov' }), null).kind).toBe('governance');
    expect(adminPath(key('GlobalConfig', 'g', 'pda_owned_by:x'), null).kind).toBe('unresolved');
  });
});

const M = Keypair.generate().publicKey.toBase58(); const N = Keypair.generate().publicKey.toBase58();

describe('buildRecords', () => {
  it('a v1 day carries the timelock back only when multisig and threshold match, and marks it', async () => {
    const v1 = [row({ program_id: 'A', authority_kind: 'squads_vault', multisig: M, threshold: 3, members: ['a', 'b', 'c', 'd'] }), row({ program_id: 'B', authority_kind: 'squads_vault', multisig: N, threshold: 2, members: ['a', 'b'] })];
    const carry = new Map<string, DayRow>([
      ['A', row({ program_id: 'A', authority_kind: 'squads_vault', multisig: M, threshold: 3, members: ['a', 'b', 'c', 'd'], timelock_s: 86400, ms_version: 'v4' })],
      ['B', row({ program_id: 'B', authority_kind: 'squads_vault', multisig: N, threshold: 3, members: ['a', 'b', 'c'], timelock_s: 86400, ms_version: 'v4' })],
    ]);
    const [a, b] = await buildRecords('2026-10-05', v1, offline, { carry });
    expect(a!.upgrade.timelockCarried).toBe(true);
    expect(a!.upgrade.multisig?.timelockS).toBe(86400);
    expect(b!.upgrade.timelockCarried).toBe(false); // threshold changed between the days: nothing carried
    expect(b!.upgrade.multisig?.timelockS).toBeNull();
  });
  it('a closed program keeps a record and carries the closed modifier', async () => {
    const [r] = await buildRecords('2026-10-08', [row({ authority_kind: 'closed', upgrade_authority: null })], offline);
    expect(r!.stage.modifiers).toContain('closed');
  });
});
