// File: packages/decoder/src/byte-parser.test.ts
// Test-first against real mainnet fixtures saved in ../test/fixtures/
// (fetched 2026-09-26 via public RPC; see evidence/2026-09-26-drift-control-state.md
// and scripts/fetch-fixtures.ts for how to re-capture them).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import bs58 from 'bs58';
import {
  parseProgramAccount,
  parseProgramData,
  parseSquadsV4Multisig,
  resolveSquadsVault,
} from './byte-parser';
import { DiscriminatorMismatchError, TruncatedBufferError } from './errors';

interface RawFixture {
  address: string;
  owner: string;
  data_b64: string;
}

function loadFixture(name: string): RawFixture {
  const raw = readFileSync(join(__dirname, '..', 'test', 'fixtures', `${name}.json`), 'utf-8');
  return JSON.parse(raw) as RawFixture;
}

function fixtureData(name: string): Buffer {
  return Buffer.from(loadFixture(name).data_b64, 'base64');
}

// Known real values, verified against the fixtures by decoding them directly
// with Buffer.readUInt32LE/readBigUInt64LE before this parser existed (see
// evidence/2026-09-26-drift-control-state.md).
const DRIFT_PROGRAM_DATA_ADDRESS = '7dLgmtcTavcguNoynVimF9ZNVb13FvhXVRfj2HyrDGaP';
const DRIFT_LAST_DEPLOY_SLOT = 429731225n;
const DRIFT_UPGRADE_AUTHORITY = '8jj7zJgdr5bDndc7evM74FMGwzLPmd4u4QxNzFi1BMai';
const DRIFT_MULTISIG_ADDRESS = '7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM';

describe('parseProgramAccount', () => {
  it('parses the real Drift Program account (tag 2) to its ProgramData address', () => {
    const data = fixtureData('drift-program');
    const parsed = parseProgramAccount(data);
    expect(parsed.tag).toBe(2);
    expect(parsed.programDataAddress).toBe(DRIFT_PROGRAM_DATA_ADDRESS);
  });

  it('rejects a buffer too short to hold the tag + pubkey', () => {
    expect(() => parseProgramAccount(Buffer.alloc(10))).toThrow(TruncatedBufferError);
  });

  it('rejects a wrong tag (e.g. tag 3, a ProgramData account)', () => {
    const wrongTag = fixtureData('pd'); // tag 3, not 2
    expect(() => parseProgramAccount(wrongTag)).toThrow(DiscriminatorMismatchError);
  });
});

describe('parseProgramData', () => {
  it('parses the real Drift ProgramData account (tag 3): slot + upgrade authority', () => {
    const data = fixtureData('pd');
    const parsed = parseProgramData(data);
    expect(parsed.tag).toBe(3);
    expect(parsed.lastDeploySlot).toBe(DRIFT_LAST_DEPLOY_SLOT);
    expect(parsed.upgradeAuthority).toBe(DRIFT_UPGRADE_AUTHORITY);
  });

  it('parses an immutable program (Option<Pubkey> == None) with upgradeAuthority null', () => {
    // Real bincode layout, synthetic bytes (no real immutable-program fixture
    // was captured): tag=3, slot=1, option tag=0. This exercises the None
    // branch of a real, verified layout rather than inventing new bytes.
    const data = Buffer.alloc(13);
    data.writeUInt32LE(3, 0);
    data.writeBigUInt64LE(1n, 4);
    data.writeUInt8(0, 12);
    const parsed = parseProgramData(data);
    expect(parsed.upgradeAuthority).toBeNull();
  });

  it('rejects a buffer too short to hold even the header', () => {
    expect(() => parseProgramData(Buffer.alloc(5))).toThrow(TruncatedBufferError);
  });

  it('rejects a wrong tag (e.g. tag 2, a Program account)', () => {
    const wrongTag = fixtureData('drift-program'); // tag 2, not 3
    expect(() => parseProgramData(wrongTag)).toThrow(DiscriminatorMismatchError);
  });
});

describe('parseSquadsV4Multisig', () => {
  it('parses the real Drift-controlling Squads v4 Multisig field by field', () => {
    const data = fixtureData('drift-squads-multisig');
    const parsed = parseSquadsV4Multisig(data);

    expect(parsed.threshold).toBe(4);
    expect(parsed.members).toHaveLength(7);
    expect(parsed.timeLock).toBe(3600);
    expect(parsed.staleTransactionIndex).toBe(87n);
    expect(parsed.transactionIndex).toBe(130n);
    expect(parsed.rentCollector).toBeNull();
    // config_authority is the all-zero System Program ID: no separate
    // governance layer above the multisig members.
    expect(parsed.configAuthority).toBe('11111111111111111111111111111111');
    expect(parsed.members.map((m) => m.permissions)).toEqual([1, 7, 7, 7, 7, 7, 7]);
  });

  it('rejects a buffer too short to hold the discriminator', () => {
    expect(() => parseSquadsV4Multisig(Buffer.alloc(4))).toThrow(TruncatedBufferError);
  });

  it('rejects a wrong account discriminator (e.g. sha256("account:Proposal"))', () => {
    const wrongDiscriminator = createHash('sha256').update('account:Proposal').digest().subarray(0, 8);
    const data = Buffer.concat([wrongDiscriminator, Buffer.alloc(100)]);
    expect(() => parseSquadsV4Multisig(data)).toThrow(DiscriminatorMismatchError);
  });

  it('parses rent_collector Some (offset-94 trap taken the other way)', () => {
    // Synthetic buffer: no real Squads v4 multisig with a Some rent_collector
    // was found among the captured fixtures, so this proves the Some branch
    // of the (real, verified-on-mainnet-bytes) layout rather than inventing
    // a fake real account. See DEV-003.
    const discriminator = createHash('sha256').update('account:Multisig').digest().subarray(0, 8);
    const createKey = Buffer.alloc(32, 1);
    const configAuthority = Buffer.alloc(32, 0);
    const fixedFields = Buffer.alloc(94 - 72);
    fixedFields.writeUInt16LE(2, 0); // threshold
    fixedFields.writeUInt32LE(0, 2); // time_lock
    fixedFields.writeBigUInt64LE(0n, 6); // transaction_index
    fixedFields.writeBigUInt64LE(0n, 14); // stale_transaction_index
    const rentCollectorTag = Buffer.from([1]);
    const rentCollectorPubkey = Buffer.alloc(32, 9);
    const bump = Buffer.from([255]);
    const memberCount = Buffer.alloc(4);
    memberCount.writeUInt32LE(1, 0);
    const memberKey = Buffer.alloc(32, 2);
    const memberPermissions = Buffer.from([7]);

    const data = Buffer.concat([
      discriminator,
      createKey,
      configAuthority,
      fixedFields,
      rentCollectorTag,
      rentCollectorPubkey,
      bump,
      memberCount,
      memberKey,
      memberPermissions,
    ]);

    const parsed = parseSquadsV4Multisig(data);
    expect(parsed.rentCollector).toBe(bs58.encode(rentCollectorPubkey));
    expect(parsed.members).toEqual([{ key: bs58.encode(memberKey), permissions: 7 }]);
  });
});

describe('resolveSquadsVault', () => {
  it('resolves the real Drift upgrade-authority vault to its controlling multisig at index 0', () => {
    const resolved = resolveSquadsVault(DRIFT_UPGRADE_AUTHORITY, [DRIFT_MULTISIG_ADDRESS]);
    expect(resolved).toEqual({ multisig: DRIFT_MULTISIG_ADDRESS, vaultIndex: 0 });
  });

  it('returns null when no candidate multisig derives the vault', () => {
    // A real but unrelated pubkey (the Drift program itself, not a multisig).
    const resolved = resolveSquadsVault(DRIFT_UPGRADE_AUTHORITY, ['dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH']);
    expect(resolved).toBeNull();
  });
});
