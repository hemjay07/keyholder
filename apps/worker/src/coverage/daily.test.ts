import { describe, expect, it } from 'vitest';
import { plan } from './daily';

describe('plan', () => {
  it('happy: same authority with a known multisig -> re-read the multisig', () => {
    expect(plan({ programId: 'P', upgradeAuthority: 'A', authorityKind: 'squads_vault', multisig: { address: 'M' } }, 'A')).toBe('reread-multisig');
  });
  it('edge: same authority, single key -> keep (nothing else to read)', () => {
    expect(plan({ programId: 'P', upgradeAuthority: 'A', authorityKind: 'single_key', multisig: null }, 'A')).toBe('keep');
  });
  it('edge: the authority was removed -> immutable', () => {
    expect(plan({ programId: 'P', upgradeAuthority: 'A', authorityKind: 'single_key' }, null)).toBe('immutable');
  });
  it('error: a different authority than coverage recorded -> re-resolve (a real control change)', () => {
    expect(plan({ programId: 'P', upgradeAuthority: 'A', authorityKind: 'squads_vault', multisig: { address: 'M' } }, 'B')).toBe('resolve');
  });
});
