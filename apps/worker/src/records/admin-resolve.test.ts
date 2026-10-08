import { describe, expect, it } from 'vitest';
import { v4Vault, vaultIndex } from './admin-resolve';

describe('Squads vault derivation (real mainnet accounts, read 2026-10-03)', () => {
  it("Kamino's upgrade authority GzFgdRJX is vault 0 of multisig 6hhBGCtm", () => {
    expect(v4Vault('6hhBGCtmg7tPWUSgp3LG6X2rsmYWAc4tNsA6G4CnfQbM', 0)).toBe('GzFgdRJXmawPhGeBsyRCDLx4jAKPsvbUqoqitzppkzkW');
  });
  it("Kamino's main market owner 24LjDBuk is vault 0 of multisig 7idEEVRi", () => {
    expect(v4Vault('7idEEVRidWrahZJhxXMqniDbV6ESj7ZjyLrigcMcEt6H', 0)).toBe('24LjDBukaUSHgPowcF2wY1XscnhChcBUDETN2UhBZMMT');
  });
  it('the index maps a vault back to its multisig; an unrelated key is absent', () => {
    const idx = vaultIndex([{ address: '7idEEVRidWrahZJhxXMqniDbV6ESj7ZjyLrigcMcEt6H', version: 'v4' }]);
    expect(idx.get('24LjDBukaUSHgPowcF2wY1XscnhChcBUDETN2UhBZMMT')?.multisig).toBe('7idEEVRidWrahZJhxXMqniDbV6ESj7ZjyLrigcMcEt6H');
    expect(idx.get('GzFgdRJXmawPhGeBsyRCDLx4jAKPsvbUqoqitzppkzkW')).toBeUndefined();
  });
});
