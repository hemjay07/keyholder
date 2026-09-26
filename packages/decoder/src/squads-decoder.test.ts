// File: packages/decoder/src/squads-decoder.test.ts
// Real Squads v4 fixtures (fetched 2026-09-26; see scripts/tmp-fetch-all-fixtures.ts).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import {
  asConfigTransactionCreate,
  decodeSquadsInstruction,
  resolveVaultTransactionCpis,
  type RawInnerInstruction,
} from './squads-decoder';

function loadSquadsIdl(): Record<string, unknown> {
  const raw = readFileSync(join(__dirname, '..', 'test', 'fixtures', 'squads-legacy-idl-account.json'), 'utf-8');
  const { data_b64 } = JSON.parse(raw) as { data_b64: string };
  const data = Buffer.from(data_b64, 'base64');
  const len = data.readUInt32LE(40);
  return JSON.parse(inflateSync(data.subarray(44, 44 + len)).toString('utf8'));
}

interface IxFixture {
  data_hex: string;
  innerInstructions?: { programId: string; data_hex: string; accounts: string[] }[];
}

function loadIxFixture(name: string): IxFixture {
  const raw = readFileSync(join(__dirname, '..', 'test', 'fixtures', `ix-${name}.json`), 'utf-8');
  return JSON.parse(raw) as IxFixture;
}

const SQUADS_IDL = loadSquadsIdl();

describe('decodeSquadsInstruction', () => {
  it('decodes a real proposalCreate instruction', () => {
    const fx = loadIxFixture('squads-proposal-create');
    const result = decodeSquadsInstruction(SQUADS_IDL, Buffer.from(fx.data_hex, 'hex'));
    expect(result.kind).toBe('decoded');
    if (result.kind !== 'decoded') throw new Error('unreachable');
    expect(result.ix.name).toBe('proposalCreate');
  });
});

describe('asConfigTransactionCreate', () => {
  it('narrows the real AddMember config action from a real configTransactionCreate instruction', () => {
    const fx = loadIxFixture('squads-config-transaction-create');
    const result = decodeSquadsInstruction(SQUADS_IDL, Buffer.from(fx.data_hex, 'hex'));
    const decoded = asConfigTransactionCreate(result);
    expect(decoded.actions).toHaveLength(1);
    expect(decoded.actions[0].variant).toBe('AddMember');
    expect(decoded.memo).toBeNull();
  });

  it('throws for a non-configTransactionCreate instruction (e.g. proposalReject)', () => {
    const fx = loadIxFixture('squads-proposal-reject');
    const result = decodeSquadsInstruction(SQUADS_IDL, Buffer.from(fx.data_hex, 'hex'));
    expect(() => asConfigTransactionCreate(result)).toThrow();
  });

  it('throws for an undecoded result', () => {
    expect(() => asConfigTransactionCreate({ kind: 'undecoded', reason: 'x', programId: 'p', dataHex: '' })).toThrow();
  });
});

describe('resolveVaultTransactionCpis', () => {
  it('extracts the real inner CPI(s) triggered by a real vaultTransactionExecute', () => {
    const fx = loadIxFixture('squads-vault-transaction-execute');
    expect(fx.innerInstructions).toBeDefined();
    const inner: RawInnerInstruction[] = fx.innerInstructions!.map((i) => ({
      programId: i.programId,
      data: Buffer.from(i.data_hex, 'hex'),
      accounts: i.accounts,
    }));
    const resolved = resolveVaultTransactionCpis(inner);
    expect(resolved.length).toBeGreaterThan(0);
    // Real data: the vault's first CPI in this tx is a System Program call.
    expect(resolved.some((ix) => ix.programId === '11111111111111111111111111111111')).toBe(true);
  });

  it('returns an empty array for a vault transaction with no inner instructions', () => {
    expect(resolveVaultTransactionCpis([])).toEqual([]);
  });
});
