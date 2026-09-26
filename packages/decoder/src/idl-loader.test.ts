// File: packages/decoder/src/idl-loader.test.ts
// Test-first against real mainnet fixtures saved in ../test/fixtures/
// (fetched 2026-09-26 via public RPC; see scripts/tmp-fetch-all-fixtures.ts
// history in evidence for how they were captured).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PublicKey } from '@solana/web3.js';
import {
  canonicalMetadataPda,
  decodeLegacyAnchorIdlAccount,
  decodeProgramMetadataAccount,
  legacyAnchorIdlAddress,
  IdlNotSupportedError,
} from './idl-loader';

interface RawFixture {
  address: string;
  owner: string;
  data_b64: string;
}

function fixtureData(name: string): Buffer {
  const raw = readFileSync(join(__dirname, '..', 'test', 'fixtures', `${name}.json`), 'utf-8');
  const fixture = JSON.parse(raw) as RawFixture;
  return Buffer.from(fixture.data_b64, 'base64');
}

const DRIFT_PROGRAM_ID = new PublicKey('dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH');

describe('legacyAnchorIdlAddress', () => {
  it('derives the real legacy IDL address for Drift', () => {
    expect(legacyAnchorIdlAddress(DRIFT_PROGRAM_ID).toBase58()).toBe('8BKPjRu7Hvd6Y2J67EdLx9MsrZFQwEMVwYg7NeVbAPF8');
  });

  it('derives a different, deterministic address for a different program (Kamino)', () => {
    const kamino = new PublicKey('KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD');
    expect(legacyAnchorIdlAddress(kamino).toBase58()).toBe('8qLKwp1fk8WyqmzarkuMeZEX3AzL4VDSmA2UZTKT2aCJ');
  });
});

describe('decodeLegacyAnchorIdlAccount', () => {
  it('decodes the real Drift legacy IDL account into a valid Anchor IDL', () => {
    const idl = decodeLegacyAnchorIdlAccount(fixtureData('drift-legacy-idl-account'));
    expect(idl.name).toBe('drift');
    expect(Array.isArray(idl.instructions)).toBe(true);
    expect((idl.instructions as unknown[]).length).toBeGreaterThan(200);
  });

  it('decodes the real Kamino legacy IDL account (second program, per Task 2.1)', () => {
    const idl = decodeLegacyAnchorIdlAccount(fixtureData('kamino-legacy-idl-account'));
    expect(idl.name).toBe('kamino_lending');
    expect(Array.isArray(idl.instructions)).toBe(true);
  });

  it('decodes the real Squads v4 legacy IDL account', () => {
    const idl = decodeLegacyAnchorIdlAccount(fixtureData('squads-legacy-idl-account'));
    expect(idl.name).toBe('squads_multisig_program');
    const ix = (idl.instructions as { name: string }[]).find((i) => i.name === 'configTransactionCreate');
    expect(ix).toBeDefined();
  });

  it('rejects a buffer too short to hold the header', () => {
    expect(() => decodeLegacyAnchorIdlAccount(Buffer.alloc(10))).toThrow(IdlNotSupportedError);
  });

  it('rejects a buffer with the wrong discriminator (e.g. a Squads Multisig account)', () => {
    expect(() => decodeLegacyAnchorIdlAccount(fixtureData('drift-squads-multisig'))).toThrow(IdlNotSupportedError);
  });
});

describe('canonicalMetadataPda', () => {
  it('derives the real canonical Program Metadata PDA for Drift', () => {
    expect(canonicalMetadataPda(DRIFT_PROGRAM_ID).toBase58()).toBe('7DuBKBbixzCJEFgvAxpt7MCUuSwuY854iYJ4BLpzPEVt');
  });
});

describe('decodeProgramMetadataAccount', () => {
  it('decodes the real Drift canonical Program Metadata IDL account', () => {
    const idl = decodeProgramMetadataAccount(fixtureData('idl-drift-program-metadata'));
    // This is a newer-spec (0.1.0) Anchor IDL: name lives under `metadata`,
    // not at the top level like the legacy-account IDLs above.
    expect((idl.metadata as { name: string }).name).toBe('drift');
    expect(Array.isArray(idl.instructions)).toBe(true);
    expect((idl.instructions as unknown[]).length).toBeGreaterThan(0);
  });

  it('rejects a buffer too short to hold the fixed 96-byte header', () => {
    expect(() => decodeProgramMetadataAccount(Buffer.alloc(50))).toThrow(IdlNotSupportedError);
  });

  it('rejects an account whose dataSource is not Direct (honest unsupported, never guessed)', () => {
    const real = fixtureData('idl-drift-program-metadata');
    const mutated = Buffer.from(real);
    mutated.writeUInt8(1, 86); // dataSource byte -> Url
    expect(() => decodeProgramMetadataAccount(mutated)).toThrow(IdlNotSupportedError);
  });
});
