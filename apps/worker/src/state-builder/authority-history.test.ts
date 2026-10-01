// File: apps/worker/src/state-builder/authority-history.test.ts
// Task DEV-043 (coordinator review) — unit tests (happy/edge/error) for
// resolveAuthorityHistorically, mocking Connection over real program ids
// (SQDS4ep6... v4, SMPLecH... v3, GovER5L... SPL Governance) and real
// byte layouts, the same pattern as authority.test.ts / registry.test.ts.

import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  SQUADS_V4_PROGRAM_ID,
  SQUADS_V3_PROGRAM_ID,
  BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
  deriveSquadsVaultPda,
  deriveSquadsV3VaultPda,
} from '@keyholder/decoder';
import { SPL_GOVERNANCE_PROGRAM_ID } from '../ingest/filter';
import { resolveAuthorityHistorically } from './authority-history';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORAL_MULTISIG_PROGRAM_ID } from '@keyholder/decoder';

// Real mainnet account: Marinade's upgrade-authority multisig (captured 2026-09-27).
const coralFixture = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', '..', 'data', 'fixtures-for-decoder', 'coral-multisig-marinade.json'), 'utf8')
) as { address: string; signerPda: string; dataBase64: string };

function v4MultisigBuffer(threshold: number, timeLock: number, members: PublicKey[]): Buffer {
  const disc = createHash('sha256').update('account:Multisig').digest().subarray(0, 8);
  const head = Buffer.alloc(94 + 1 + 1 + 4);
  disc.copy(head, 0);
  head.writeUInt16LE(threshold, 72);
  head.writeUInt32LE(timeLock, 74);
  head.writeUInt8(0, 94);
  head.writeUInt8(254, 95);
  head.writeUInt32LE(members.length, 96);
  const memberBytes = Buffer.concat(members.map((m) => Buffer.concat([m.toBuffer(), Buffer.from([7])])));
  return Buffer.concat([head, memberBytes]);
}

function v3MultisigBuffer(threshold: number, createKey: PublicKey, members: PublicKey[]): Buffer {
  const disc = createHash('sha256').update('account:Ms').digest().subarray(0, 8);
  const head = Buffer.alloc(58);
  disc.copy(head, 0);
  head.writeUInt16LE(threshold, 8);
  head.writeUInt16LE(1, 10);
  head.writeUInt32LE(1, 12);
  head.writeUInt32LE(0, 16);
  head.writeUInt8(255, 20);
  createKey.toBuffer().copy(head, 21);
  head.writeUInt8(0, 53);
  head.writeUInt32LE(members.length, 54);
  return Buffer.concat([head, Buffer.concat(members.map((m) => m.toBuffer()))]);
}

function fakeAccount(pubkey: PublicKey, signer: boolean) {
  return { pubkey, signer, writable: false, source: 'transaction' };
}

describe('resolveAuthorityHistorically', () => {
  it('happy: resolves via a real Squads v4 invocation in the authority\'s own history', async () => {
    const authority = deriveSquadsVaultPda(new PublicKey('7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM'), 0, new PublicKey(SQUADS_V4_PROGRAM_ID));
    const multisigPk = new PublicKey('7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM');
    const multisigBuf = v4MultisigBuffer(4, 3600, [Keypair.generate().publicKey, Keypair.generate().publicKey, Keypair.generate().publicKey, Keypair.generate().publicKey]);

    const connection = {
      getAccountInfo: vi.fn(async (pk: PublicKey) => {
        if (pk.equals(multisigPk)) return { data: multisigBuf, owner: new PublicKey(SQUADS_V4_PROGRAM_ID) } as any;
        return null;
      }),
      getSignaturesForAddress: vi.fn(async () => [{ signature: 'sig1', slot: 1 }]),
      getParsedTransaction: vi.fn(async () => ({
        transaction: {
          message: {
            accountKeys: [fakeAccount(authority, true), fakeAccount(multisigPk, false)],
            instructions: [{ programId: new PublicKey(SQUADS_V4_PROGRAM_ID) }],
          },
        },
        meta: { innerInstructions: [] },
      })),
    } as any;

    const result = await resolveAuthorityHistorically(connection, authority.toBase58());
    expect(result.authorityKind).toBe('squads_vault');
    expect(result.multisig?.address).toBe(multisigPk.toBase58());
    expect(result.multisig?.threshold).toBe(4);
    expect(result.multisig?.programVersion).toBe('v4');
    expect(result.evidenceSignature).toBe('sig1');
  });

  it('happy: resolves via a Squads v3 invocation', async () => {
    const multisigPk = Keypair.generate().publicKey;
    const authority = deriveSquadsV3VaultPda(multisigPk, 1, new PublicKey(SQUADS_V3_PROGRAM_ID));
    const multisigBuf = v3MultisigBuffer(2, Keypair.generate().publicKey, [Keypair.generate().publicKey, Keypair.generate().publicKey]);

    const connection = {
      getAccountInfo: vi.fn(async (pk: PublicKey) => {
        if (pk.equals(multisigPk)) return { data: multisigBuf, owner: new PublicKey(SQUADS_V3_PROGRAM_ID) } as any;
        return null;
      }),
      getSignaturesForAddress: vi.fn(async () => [{ signature: 'sigv3', slot: 1 }]),
      getParsedTransaction: vi.fn(async () => ({
        transaction: {
          message: {
            accountKeys: [fakeAccount(authority, true), fakeAccount(multisigPk, false)],
            instructions: [{ programId: new PublicKey(SQUADS_V3_PROGRAM_ID) }],
          },
        },
        meta: { innerInstructions: [] },
      })),
    } as any;

    const result = await resolveAuthorityHistorically(connection, authority.toBase58());
    expect(result.authorityKind).toBe('squads_vault');
    expect(result.multisig?.programVersion).toBe('v3');
    expect(result.multisig?.timeLockS).toBe(0);
  });

  it('happy: classifies single_key when the authority itself signs a loader ix with no Squads present', async () => {
    const authority = Keypair.generate().publicKey;
    const connection = {
      getAccountInfo: vi.fn(async () => null),
      getSignaturesForAddress: vi.fn(async () => [{ signature: 'sigLoader', slot: 1 }]),
      getParsedTransaction: vi.fn(async () => ({
        transaction: {
          message: {
            accountKeys: [fakeAccount(authority, true)],
            instructions: [{ programId: new PublicKey(BPF_LOADER_UPGRADEABLE_PROGRAM_ID) }],
          },
        },
        meta: { innerInstructions: [] },
      })),
    } as any;

    const result = await resolveAuthorityHistorically(connection, authority.toBase58());
    expect(result.authorityKind).toBe('single_key');
    expect(result.evidenceSignature).toBe('sigLoader');
  });

  it('happy: classifies spl_gov when the authority account is owned by the Realms program', async () => {
    const authority = Keypair.generate().publicKey;
    const connection = {
      getAccountInfo: vi.fn(async () => ({ data: Buffer.alloc(0), owner: new PublicKey(SPL_GOVERNANCE_PROGRAM_ID) } as any)),
      getSignaturesForAddress: vi.fn(),
      getParsedTransaction: vi.fn(),
    } as any;

    const result = await resolveAuthorityHistorically(connection, authority.toBase58());
    expect(result.authorityKind).toBe('spl_gov');
    expect(connection.getSignaturesForAddress).not.toHaveBeenCalled();
  });

  it('edge: no on-chain history at all -> unresolved with a "no history" note, never guessed', async () => {
    const authority = Keypair.generate().publicKey;
    const connection = {
      getAccountInfo: vi.fn(async () => null),
      getSignaturesForAddress: vi.fn(async () => []),
      getParsedTransaction: vi.fn(),
    } as any;

    const result = await resolveAuthorityHistorically(connection, authority.toBase58());
    expect(result.authorityKind).toBe('single_key_or_vault_unresolved');
    expect(result.evidenceNote).toContain('no on-chain history: 0 signatures');
    expect(result.signaturesScanned).toBe(0);
  });

  it('edge: transactions exist but none match any evidence -> stays unresolved, with the real scanned count', async () => {
    const authority = Keypair.generate().publicKey;
    const connection = {
      getAccountInfo: vi.fn(async () => null),
      getSignaturesForAddress: vi.fn(async () => [{ signature: 'a', slot: 1 }, { signature: 'b', slot: 2 }]),
      getParsedTransaction: vi.fn(async () => ({
        // Spec change 2026-10-02: the authority appears in the txs but is NOT a top-level
        // signer (a signer would prove it is a keypair, rule 3). Nothing else matches.
        transaction: { message: { accountKeys: [fakeAccount(authority, false)], instructions: [{ programId: new PublicKey('11111111111111111111111111111111') }] } },
        meta: { innerInstructions: [] },
      })),
    } as any;

    const result = await resolveAuthorityHistorically(connection, authority.toBase58());
    expect(result.authorityKind).toBe('single_key_or_vault_unresolved');
    expect(result.signaturesScanned).toBe(2);
    expect(result.evidenceNote).toContain('2 signatures scanned');
  });

  it('happy: an authority that is a top-level signer of any tx is a keypair: single_key (rule 3)', async () => {
    const authority = Keypair.generate().publicKey;
    const connection = {
      getAccountInfo: vi.fn(async () => null),
      getSignaturesForAddress: vi.fn(async () => [{ signature: 'paid', slot: 1 }]),
      getParsedTransaction: vi.fn(async () => ({
        transaction: { message: { accountKeys: [fakeAccount(authority, true)], instructions: [{ programId: new PublicKey('11111111111111111111111111111111') }] } },
        meta: { innerInstructions: [] },
      })),
    } as any;

    const result = await resolveAuthorityHistorically(connection, authority.toBase58());
    expect(result.authorityKind).toBe('single_key');
    expect(result.evidenceSignature).toBe('paid');
    expect(result.evidenceNote).toContain('top-level signer');
  });

  it('error: getSignaturesForAddress throwing is caught and reported, not fatal', async () => {
    const authority = Keypair.generate().publicKey;
    const connection = {
      getAccountInfo: vi.fn(async () => null),
      getSignaturesForAddress: vi.fn(async () => {
        throw new Error('429 rate limited');
      }),
      getParsedTransaction: vi.fn(),
    } as any;

    const result = await resolveAuthorityHistorically(connection, authority.toBase58());
    expect(result.authorityKind).toBe('single_key_or_vault_unresolved');
    expect(result.evidenceNote).toContain('429 rate limited');
  });

  it('error: a Squads-owned account that fails to parse (wrong discriminator) is skipped, not thrown', async () => {
    const authority = deriveSquadsVaultPda(new PublicKey('7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM'), 0, new PublicKey(SQUADS_V4_PROGRAM_ID));
    const notAMultisig = Keypair.generate().publicKey;
    const connection = {
      getAccountInfo: vi.fn(async (pk: PublicKey) => {
        if (pk.equals(notAMultisig)) return { data: Buffer.alloc(94), owner: new PublicKey(SQUADS_V4_PROGRAM_ID) } as any; // wrong discriminator
        return null;
      }),
      getSignaturesForAddress: vi.fn(async () => [{ signature: 'sigBad', slot: 1 }]),
      getParsedTransaction: vi.fn(async () => ({
        transaction: {
          message: {
            // A vault PDA is never a top-level signer on a real tx (spec change 2026-10-02).
            accountKeys: [fakeAccount(authority, false), fakeAccount(notAMultisig, false)],
            instructions: [{ programId: new PublicKey(SQUADS_V4_PROGRAM_ID) }],
          },
        },
        meta: { innerInstructions: [] },
      })),
    } as any;

    const result = await resolveAuthorityHistorically(connection, authority.toBase58());
    expect(result.authorityKind).toBe('single_key_or_vault_unresolved');
  });

  function coralConnection(authority: string, programInvoked: string) {
    const multisigPk = new PublicKey(coralFixture.address);
    return {
      getAccountInfo: vi.fn(async (pk: PublicKey) => {
        if (pk.equals(multisigPk)) return { data: Buffer.from(coralFixture.dataBase64, 'base64'), owner: new PublicKey(CORAL_MULTISIG_PROGRAM_ID) } as any;
        return null;
      }),
      getSignaturesForAddress: vi.fn(async () => [{ signature: 'wyCLBN', slot: 1 }]),
      getParsedTransaction: vi.fn(async () => ({
        transaction: {
          message: {
            accountKeys: [fakeAccount(Keypair.generate().publicKey, true), fakeAccount(multisigPk, false), fakeAccount(new PublicKey(authority), false)],
            instructions: [{ programId: new PublicKey(programInvoked) }],
          },
        },
        meta: { innerInstructions: [] },
      })),
    } as any;
  }

  it('happy: resolves Marinade\'s authority to its coral multisig (real bytes): 6 of 13, no timelock feature', async () => {
    const result = await resolveAuthorityHistorically(coralConnection(coralFixture.signerPda, CORAL_MULTISIG_PROGRAM_ID), coralFixture.signerPda);
    expect(result.authorityKind).toBe('coral_multisig');
    expect(result.multisig?.address).toBe(coralFixture.address);
    expect(result.multisig?.threshold).toBe(6);
    expect(result.multisig?.memberCount).toBe(13);
    expect(result.multisig?.programVersion).toBe('coral');
    expect(result.evidenceSignature).toBe('wyCLBN');
  });

  it('edge: a coral multisig whose signer is NOT the authority does not resolve it', async () => {
    const stranger = Keypair.generate().publicKey.toBase58();
    const result = await resolveAuthorityHistorically(coralConnection(stranger, CORAL_MULTISIG_PROGRAM_ID), stranger);
    expect(result.authorityKind).toBe('single_key_or_vault_unresolved');
  });

  it('error: the coral account present but the coral program not invoked is not evidence', async () => {
    const result = await resolveAuthorityHistorically(coralConnection(coralFixture.signerPda, SQUADS_V4_PROGRAM_ID), coralFixture.signerPda);
    expect(result.authorityKind).toBe('single_key_or_vault_unresolved');
  });
});
