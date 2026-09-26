// File: packages/decoder/src/privilege-classifier.test.ts
// Real Squads v4 IDL + real Drift admin instruction/account, from the same
// fixtures as anchor-decoder.test.ts.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { classifyPrivilege, type AccountMeta } from './privilege-classifier';

function loadLegacyIdl(fixtureName: string): Record<string, unknown> {
  const raw = readFileSync(join(__dirname, '..', 'test', 'fixtures', `${fixtureName}.json`), 'utf-8');
  const { data_b64 } = JSON.parse(raw) as { data_b64: string };
  const data = Buffer.from(data_b64, 'base64');
  const len = data.readUInt32LE(40);
  return JSON.parse(inflateSync(data.subarray(44, 44 + len)).toString('utf8'));
}

const SQUADS_IDL = loadLegacyIdl('squads-legacy-idl-account');
const DRIFT_IDL = loadLegacyIdl('drift-legacy-idl-account');

// Real Drift admin account (see evidence: Drift State.admin field).
const DRIFT_ADMIN = 'H7PiGqqUaanBovwKgEtreJbKmQe6dbq6VTrw6guy7ZgL';
const DRIFT_STATE = '5zpq7DvB6UdFFvpmBPspGPNfUGoBRRCE2HHg5u3gxcsN';
const DRIFT_SPOT_MARKET = 'DKrLnef7CqmbfGioM5Snn2mhzt8Ec4MmxU4fb7dQBsYU';

function driftUpdateWithdrawGuardAccounts(): AccountMeta[] {
  return [
    { name: 'admin', pubkey: DRIFT_ADMIN, isSigner: true },
    { name: 'state', pubkey: DRIFT_STATE, isSigner: false },
    { name: 'spotMarket', pubkey: DRIFT_SPOT_MARKET, isSigner: false },
  ];
}

describe('classifyPrivilege — name heuristic (happy path)', () => {
  it('flags the real updateWithdrawGuardThreshold instruction via the "admin" name match', () => {
    const verdict = classifyPrivilege(DRIFT_IDL, 'updateWithdrawGuardThreshold', driftUpdateWithdrawGuardAccounts(), new Set());
    expect(verdict.privileged).toBe(true);
    expect(verdict.basis).toBe('name');
    expect(verdict.matchedAccount).toBe('admin');
  });
});

describe('classifyPrivilege — runtime match wins over name heuristic', () => {
  it('reports runtime_match, not name, when the signer is also a known controller', () => {
    const verdict = classifyPrivilege(
      DRIFT_IDL,
      'updateWithdrawGuardThreshold',
      driftUpdateWithdrawGuardAccounts(),
      new Set([DRIFT_ADMIN])
    );
    expect(verdict.privileged).toBe(true);
    expect(verdict.basis).toBe('runtime_match');
  });

  it('catches a badly-named signer purely via runtime match (Squads member on vaultTransactionExecute)', () => {
    // vaultTransactionExecute's signer is named "member", which the name
    // heuristic does NOT match — this is exactly the case runtime match
    // exists to catch.
    const member = '7CZffT9hnZtCz1paZiP6pb7GgsFLAN9rAejxuk2MBoKc'; // real signer, ix-squads-vault-transaction-execute fixture
    const accounts: AccountMeta[] = [
      { name: 'multisig', pubkey: '7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM', isSigner: false },
      { name: 'proposal', pubkey: 'DNBBgBFnCixcjxLzxxK1pm6xWumRWTRvCLmdij4Rytr', isSigner: false },
      { name: 'transaction', pubkey: '6SGHjQLkxVM2Hyv6VGY12rQMYYgg41S4fMeuC1y7qqKp', isSigner: false },
      { name: 'member', pubkey: member, isSigner: true },
    ];
    const noMatch = classifyPrivilege(SQUADS_IDL, 'vaultTransactionExecute', accounts, new Set());
    expect(noMatch.privileged).toBe(false);

    const withMatch = classifyPrivilege(SQUADS_IDL, 'vaultTransactionExecute', accounts, new Set([member]));
    expect(withMatch.privileged).toBe(true);
    expect(withMatch.basis).toBe('runtime_match');
  });
});

describe('classifyPrivilege — edge cases', () => {
  it('returns not-privileged with basis null for an instruction not present in the IDL', () => {
    const verdict = classifyPrivilege(DRIFT_IDL, 'notARealInstruction', [], new Set());
    expect(verdict.privileged).toBe(false);
    expect(verdict.basis).toBeNull();
  });

  it('still applies the IDL name heuristic with an empty runtime account list (no runtime data available)', () => {
    // The name/relation bases read the IDL's own account defs, not the
    // caller-supplied runtime list, so this still fires — only
    // runtime_match needs real accounts to check against.
    const verdict = classifyPrivilege(DRIFT_IDL, 'updateWithdrawGuardThreshold', [], new Set());
    expect(verdict.privileged).toBe(true);
    expect(verdict.basis).toBe('name');
  });

  it('does not flag a non-signer account even if its name matches the pattern', () => {
    // Construct a minimal synthetic IDL purely to prove the isSigner gate —
    // no real instruction with a non-signer "admin" account was found.
    const idl = {
      instructions: [{ name: 'readOnlyAdminView', accounts: [{ name: 'admin', isSigner: false }], args: [] }],
    };
    const verdict = classifyPrivilege(idl, 'readOnlyAdminView', [{ name: 'admin', pubkey: 'x', isSigner: false }], new Set());
    expect(verdict.privileged).toBe(false);
  });
});

describe('classifyPrivilege — error path', () => {
  it('does not throw when accounts carry pubkeys absent from the IDL account list (length mismatch)', () => {
    expect(() =>
      classifyPrivilege(DRIFT_IDL, 'updateWithdrawGuardThreshold', [{ pubkey: 'onlyOne', isSigner: true }], new Set())
    ).not.toThrow();
  });
});
