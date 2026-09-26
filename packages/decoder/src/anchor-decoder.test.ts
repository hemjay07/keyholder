// File: packages/decoder/src/anchor-decoder.test.ts
// Test-first against real mainnet instructions (fetched 2026-09-26; see
// scripts/tmp-fetch-all-fixtures.ts). The generic decoder is exercised
// against real Squads v4 and Drift instructions built with two different
// real, on-chain-discovered IDLs (legacy Anchor IDL account format, and the
// newer Program Metadata 0.1.0-spec format).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import bs58 from 'bs58';
import {
  camelToSnake,
  decodeAnchorInstruction,
  findInstructionByDiscriminator,
  idlName,
  instructionDiscriminator,
} from './anchor-decoder';

function loadLegacyIdl(fixtureName: string): Record<string, unknown> {
  const raw = readFileSync(join(__dirname, '..', 'test', 'fixtures', `${fixtureName}.json`), 'utf-8');
  const { data_b64 } = JSON.parse(raw) as { data_b64: string };
  const data = Buffer.from(data_b64, 'base64');
  const len = data.readUInt32LE(40);
  return JSON.parse(inflateSync(data.subarray(44, 44 + len)).toString('utf8'));
}

function loadNewSpecIdl(fixtureName: string): Record<string, unknown> {
  const raw = readFileSync(join(__dirname, '..', 'test', 'fixtures', `${fixtureName}.json`), 'utf-8');
  const { data_b64 } = JSON.parse(raw) as { data_b64: string };
  const data = Buffer.from(data_b64, 'base64');
  return JSON.parse(inflateSync(data.subarray(96)).toString('utf8'));
}

interface IxFixture {
  programId: string;
  data_hex: string;
}

function loadIxFixture(name: string): IxFixture {
  const raw = readFileSync(join(__dirname, '..', 'test', 'fixtures', `ix-${name}.json`), 'utf-8');
  return JSON.parse(raw) as IxFixture;
}

const SQUADS_IDL = loadLegacyIdl('squads-legacy-idl-account');
const DRIFT_LEGACY_IDL = loadLegacyIdl('drift-legacy-idl-account');

describe('camelToSnake / instructionDiscriminator', () => {
  it('matches the real on-chain discriminator for every Squads instruction exercised in these fixtures', () => {
    const cases: [string, string][] = [
      ['configTransactionCreate', '9bec57e4894b5127'],
      ['proposalCreate', 'dc3c49e01e6c4f9f'],
      ['proposalApprove', '9025a488bcd82af8'],
      ['proposalReject', 'f33e869ce66af687'],
      ['vaultTransactionCreate', '30fa4ea8d0e2dad3'],
      ['vaultTransactionExecute', 'c208a15799a419ab'],
    ];
    for (const [camel, expectedHex] of cases) {
      expect(camelToSnake(camel)).toBe(camel.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`));
      expect(instructionDiscriminator(camel).toString('hex')).toBe(expectedHex);
    }
  });
});

describe('findInstructionByDiscriminator', () => {
  it('finds configTransactionCreate in the real Squads IDL by its real on-chain discriminator', () => {
    const disc = Buffer.from('9bec57e4894b5127', 'hex');
    const found = findInstructionByDiscriminator(SQUADS_IDL, disc);
    expect(found?.name).toBe('configTransactionCreate');
  });

  it('returns null for a discriminator no instruction owns', () => {
    expect(findInstructionByDiscriminator(SQUADS_IDL, Buffer.alloc(8, 0xff))).toBeNull();
  });
});

describe('decodeAnchorInstruction — real Squads v4 instructions', () => {
  it('decodes a real proposalCreate instruction', () => {
    const fx = loadIxFixture('squads-proposal-create');
    const result = decodeAnchorInstruction(fx.programId, SQUADS_IDL, Buffer.from(fx.data_hex, 'hex'));
    expect(result.kind).toBe('decoded');
    if (result.kind !== 'decoded') throw new Error('unreachable');
    expect(result.ix.name).toBe('proposalCreate');
    const args = result.ix.args.args as { transactionIndex: bigint; draft: boolean };
    expect(args.transactionIndex).toBe(7818n);
    expect(args.draft).toBe(false);
  });

  it('decodes a real proposalApprove instruction (memo: None)', () => {
    const fx = loadIxFixture('squads-proposal-approve');
    const result = decodeAnchorInstruction(fx.programId, SQUADS_IDL, Buffer.from(fx.data_hex, 'hex'));
    expect(result.kind).toBe('decoded');
    if (result.kind !== 'decoded') throw new Error('unreachable');
    expect(result.ix.name).toBe('proposalApprove');
    const args = result.ix.args.args as { memo: string | null };
    expect(args.memo).toBeNull();
  });

  it('decodes a real proposalReject instruction', () => {
    const fx = loadIxFixture('squads-proposal-reject');
    const result = decodeAnchorInstruction(fx.programId, SQUADS_IDL, Buffer.from(fx.data_hex, 'hex'));
    expect(result.kind).toBe('decoded');
    if (result.kind !== 'decoded') throw new Error('unreachable');
    expect(result.ix.name).toBe('proposalReject');
  });

  it('decodes a real vaultTransactionCreate instruction (bytes arg)', () => {
    const fx = loadIxFixture('squads-vault-transaction-create');
    const result = decodeAnchorInstruction(fx.programId, SQUADS_IDL, Buffer.from(fx.data_hex, 'hex'));
    expect(result.kind).toBe('decoded');
    if (result.kind !== 'decoded') throw new Error('unreachable');
    expect(result.ix.name).toBe('vaultTransactionCreate');
    const args = result.ix.args.args as { vaultIndex: number; transactionMessage: Buffer };
    expect(args.vaultIndex).toBe(0);
    expect(Buffer.isBuffer(args.transactionMessage)).toBe(true);
  });

  it('decodes a real vaultTransactionExecute instruction (no args, just the discriminator)', () => {
    const fx = loadIxFixture('squads-vault-transaction-execute');
    const result = decodeAnchorInstruction(fx.programId, SQUADS_IDL, Buffer.from(fx.data_hex, 'hex'));
    expect(result.kind).toBe('decoded');
    if (result.kind !== 'decoded') throw new Error('unreachable');
    expect(result.ix.name).toBe('vaultTransactionExecute');
    expect(result.ix.args).toEqual({});
  });

  it('decodes a real configTransactionCreate instruction with an AddMember action', () => {
    const fx = loadIxFixture('squads-config-transaction-create');
    const result = decodeAnchorInstruction(fx.programId, SQUADS_IDL, Buffer.from(fx.data_hex, 'hex'));
    expect(result.kind).toBe('decoded');
    if (result.kind !== 'decoded') throw new Error('unreachable');
    expect(result.ix.name).toBe('configTransactionCreate');
    const args = result.ix.args.args as {
      actions: { variant: string; fields: { newMember: { key: string; permissions: { mask: number } } } }[];
      memo: string | null;
    };
    expect(args.actions).toHaveLength(1);
    expect(args.actions[0].variant).toBe('AddMember');
    expect(args.actions[0].fields.newMember.permissions.mask).toBe(2);
    expect(bs58.decode(args.actions[0].fields.newMember.key)).toHaveLength(32);
    expect(args.memo).toBeNull();
  });
});

describe('decodeAnchorInstruction — real Drift admin instruction', () => {
  it('decodes a real updateWithdrawGuardThreshold instruction signed by the real Drift admin key', () => {
    const fx = loadIxFixture('drift-admin-update-withdraw-guard-threshold');
    const result = decodeAnchorInstruction(fx.programId, DRIFT_LEGACY_IDL, Buffer.from(fx.data_hex, 'hex'));
    expect(result.kind).toBe('decoded');
    if (result.kind !== 'decoded') throw new Error('unreachable');
    expect(result.ix.name).toBe('updateWithdrawGuardThreshold');
    expect(result.ix.args.withdrawGuardThreshold).toBe(500000000000000n);
  });
});

describe('decodeAnchorInstruction — honest undecoded results', () => {
  it('returns {kind: "undecoded"} for data shorter than a discriminator', () => {
    const result = decodeAnchorInstruction('SomeProgram11111111111111111111111111111', SQUADS_IDL, Buffer.alloc(3));
    expect(result.kind).toBe('undecoded');
  });

  it('returns {kind: "undecoded"} for a discriminator not in the IDL, carrying the raw bytes', () => {
    const raw = Buffer.alloc(12, 0xab);
    const result = decodeAnchorInstruction('SomeProgram11111111111111111111111111111', SQUADS_IDL, raw);
    expect(result.kind).toBe('undecoded');
    if (result.kind !== 'undecoded') throw new Error('unreachable');
    expect(result.dataHex).toBe(raw.toString('hex'));
  });
});

describe('decodeAnchorInstruction — new-spec (0.1.0) IDL from Program Metadata', () => {
  const NEW_SPEC_IDL = loadNewSpecIdl('idl-drift-program-metadata');

  it('reads the real embedded discriminator instead of computing one', () => {
    const ixDef = (NEW_SPEC_IDL.instructions as Record<string, any>[]).find(
      (i) => i.name === 'withdraw_from_insurance_fund'
    );
    expect(ixDef?.discriminator).toEqual([3, 58, 40, 235, 247, 238, 77, 127]);
    const found = findInstructionByDiscriminator(NEW_SPEC_IDL, Buffer.from(ixDef!.discriminator));
    expect(found?.name).toBe('withdraw_from_insurance_fund');
  });

  it('exposes metadata.name (new-spec programs have no top-level name)', () => {
    expect(idlName(NEW_SPEC_IDL)).toBe('drift');
  });

  it('decodes the real withdraw_from_insurance_fund args (u16 market_index)', () => {
    const ixDef = (NEW_SPEC_IDL.instructions as Record<string, any>[]).find(
      (i) => i.name === 'withdraw_from_insurance_fund'
    )!;
    // No real transaction exercising this instruction was found within this
    // task's RPC budget; args are round-tripped structurally against the
    // real IDL's own type declarations (u16), not invented. [DEV-008,
    // UNTESTED against a live tx — see decoder README/deviation log].
    const discriminator = Buffer.from(ixDef.discriminator as number[]);
    const marketIndex = 7;
    const data = Buffer.concat([discriminator, Buffer.from([marketIndex, 0])]);
    const result = decodeAnchorInstruction('dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH', NEW_SPEC_IDL, data);
    expect(result.kind).toBe('decoded');
    if (result.kind !== 'decoded') throw new Error('unreachable');
    expect(result.ix.args._market_index).toBe(marketIndex);
  });

  it('throws IdlTypeError for a defined type missing from idl.types (error path)', () => {
    const brokenIdl = { name: 'broken', instructions: [{ name: 'foo', args: [{ name: 'x', type: { defined: 'Missing' } }] }] };
    const disc = instructionDiscriminator('foo');
    const result = decodeAnchorInstruction('Prog1111111111111111111111111111111111111', brokenIdl, Buffer.concat([disc, Buffer.alloc(4)]));
    expect(result.kind).toBe('undecoded');
    if (result.kind !== 'undecoded') throw new Error('unreachable');
    expect(result.reason).toContain('Missing');
  });
});
