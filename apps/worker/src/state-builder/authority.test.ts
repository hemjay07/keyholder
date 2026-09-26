// File: apps/worker/src/state-builder/authority.test.ts
// Task 3.1 — unit tests (happy/edge/error) for authority.ts's live
// classification, using the same mocked-Connection-over-real-byte-layout
// pattern as apps/worker/src/ingest/registry.test.ts. The Squads numbers
// here are Drift's real ones from evidence/2026-09-26-drift-control-state.md
// (multisig 7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM, 4-of-7, 3600s).

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { Keypair, PublicKey } from '@solana/web3.js';
import { deriveSquadsVaultPda, SQUADS_V4_PROGRAM_ID, BPF_LOADER_UPGRADEABLE_PROGRAM_ID } from '@keyholder/decoder';
import { resolveAuthority, type AuthorityTarget } from './authority';

const DRIFT_PROGRAM_ID = 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH';
const DRIFT_MULTISIG = '7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM';

function buildProgramDataBuffer(authority: PublicKey | null): Buffer {
  const buf = Buffer.alloc(authority ? 45 : 13);
  buf.writeUInt32LE(3, 0);
  buf.writeBigUInt64LE(429_731_225n, 4);
  if (authority) {
    buf.writeUInt8(1, 12);
    authority.toBuffer().copy(buf, 13);
  } else {
    buf.writeUInt8(0, 12);
  }
  return buf;
}

function buildMultisigBuffer(threshold: number, timeLock: number, memberKeys: PublicKey[], configAuthority = new PublicKey('11111111111111111111111111111111')): Buffer {
  const disc = createHash('sha256').update('account:Multisig').digest().subarray(0, 8);
  const head = Buffer.alloc(94 + 1 + 1 + 4);
  disc.copy(head, 0);
  Buffer.alloc(32).copy(head, 8);
  configAuthority.toBuffer().copy(head, 40);
  head.writeUInt16LE(threshold, 72);
  head.writeUInt32LE(timeLock, 74);
  head.writeBigUInt64LE(130n, 78);
  head.writeBigUInt64LE(87n, 86);
  head.writeUInt8(0, 94);
  head.writeUInt8(254, 95);
  head.writeUInt32LE(memberKeys.length, 96);
  const members = Buffer.concat(memberKeys.map((k) => Buffer.concat([k.toBuffer(), Buffer.from([7])])));
  return Buffer.concat([head, members]);
}

const SYSTEM_PROGRAM = new PublicKey('11111111111111111111111111111111');
const LOADER_PROGRAM = new PublicKey(BPF_LOADER_UPGRADEABLE_PROGRAM_ID);

describe('resolveAuthority', () => {
  it('happy: resolves a Squads-vault upgrade authority to its multisig (real Drift numbers: 4-of-7, 3600s)', async () => {
    const multisigPk = new PublicKey(DRIFT_MULTISIG);
    const vaultPda = deriveSquadsVaultPda(multisigPk, 0, new PublicKey(SQUADS_V4_PROGRAM_ID));
    const programDataBuf = buildProgramDataBuffer(vaultPda);
    const multisigBuf = buildMultisigBuffer(4, 3600, [
      multisigPk,
      Keypair.generate().publicKey,
      Keypair.generate().publicKey,
      Keypair.generate().publicKey,
      Keypair.generate().publicKey,
      Keypair.generate().publicKey,
      Keypair.generate().publicKey,
    ]);

    const getAccountInfo = async (pk: PublicKey) => {
      if (pk.equals(multisigPk)) return { data: multisigBuf, owner: LOADER_PROGRAM } as any;
      if (pk.equals(vaultPda)) return null; // vault PDAs are typically unfunded/no-data
      return { data: programDataBuf, owner: LOADER_PROGRAM } as any;
    };
    const target: AuthorityTarget = { programId: DRIFT_PROGRAM_ID, candidateMultisigs: [DRIFT_MULTISIG] };

    const result = await resolveAuthority({ getAccountInfo } as any, target);
    expect(result.authorityKind).toBe('squads_vault');
    expect(result.multisig?.address).toBe(DRIFT_MULTISIG);
    expect(result.multisig?.threshold).toBe(4);
    expect(result.multisig?.memberCount).toBe(7);
    expect(result.multisig?.timeLockS).toBe(3600);
  });

  it('happy: authority is a Multisig account directly (squads_v4_direct), not a vault PDA', async () => {
    const multisigPk = Keypair.generate().publicKey;
    const programDataBuf = buildProgramDataBuffer(multisigPk);
    const multisigBuf = buildMultisigBuffer(2, 0, [Keypair.generate().publicKey, Keypair.generate().publicKey]);

    const getAccountInfo = async (pk: PublicKey) => {
      if (pk.equals(multisigPk)) return { data: multisigBuf, owner: new PublicKey(SQUADS_V4_PROGRAM_ID) } as any;
      return { data: programDataBuf, owner: LOADER_PROGRAM } as any;
    };

    const result = await resolveAuthority({ getAccountInfo } as any, { programId: DRIFT_PROGRAM_ID });
    expect(result.authorityKind).toBe('squads_v4_direct');
    expect(result.multisig?.threshold).toBe(2);
    expect(result.multisig?.timeLockS).toBe(0);
  });

  it('edge: immutable when ProgramData has no upgrade authority', async () => {
    const programDataBuf = buildProgramDataBuffer(null);
    const getAccountInfo = async () => ({ data: programDataBuf, owner: LOADER_PROGRAM } as any);
    const result = await resolveAuthority({ getAccountInfo } as any, { programId: DRIFT_PROGRAM_ID });
    expect(result.authorityKind).toBe('immutable');
    expect(result.upgradeAuthority).toBeNull();
    expect(result.multisig).toBeNull();
  });

  it('edge: no candidate multisigs and authority is a plain system account -> honestly unresolved, not guessed', async () => {
    const wallet = Keypair.generate().publicKey;
    const programDataBuf = buildProgramDataBuffer(wallet);
    const getAccountInfo = async (pk: PublicKey) => {
      if (pk.equals(wallet)) return { data: Buffer.alloc(0), owner: SYSTEM_PROGRAM } as any;
      return { data: programDataBuf, owner: LOADER_PROGRAM } as any;
    };
    const result = await resolveAuthority({ getAccountInfo } as any, { programId: DRIFT_PROGRAM_ID });
    expect(result.authorityKind).toBe('single_key_or_vault_unresolved');
    expect(result.multisig).toBeNull();
  });

  it('edge: candidates given but authority does not derive from any of them -> unresolved', async () => {
    const wallet = Keypair.generate().publicKey;
    const programDataBuf = buildProgramDataBuffer(wallet);
    const getAccountInfo = async (pk: PublicKey) => {
      if (pk.equals(wallet)) return null; // unfunded wallet, no account yet
      return { data: programDataBuf, owner: LOADER_PROGRAM } as any;
    };
    const result = await resolveAuthority(
      { getAccountInfo } as any,
      { programId: DRIFT_PROGRAM_ID, candidateMultisigs: [DRIFT_MULTISIG] }
    );
    expect(result.authorityKind).toBe('single_key_or_vault_unresolved');
  });

  it('error: throws when ProgramData account does not exist', async () => {
    const getAccountInfo = async () => null;
    await expect(resolveAuthority({ getAccountInfo } as any, { programId: DRIFT_PROGRAM_ID })).rejects.toThrow(
      /ProgramData account not found/
    );
  });

  it('error: resolved multisig address has no on-chain account -> throws rather than silently returning null multisig', async () => {
    const multisigPk = new PublicKey(DRIFT_MULTISIG);
    const vaultPda = deriveSquadsVaultPda(multisigPk, 0, new PublicKey(SQUADS_V4_PROGRAM_ID));
    const programDataBuf = buildProgramDataBuffer(vaultPda);
    const getAccountInfo = async (pk: PublicKey) => {
      if (pk.equals(multisigPk)) return null; // multisig account missing
      if (pk.equals(vaultPda)) return null;
      return { data: programDataBuf, owner: LOADER_PROGRAM } as any;
    };
    await expect(
      resolveAuthority({ getAccountInfo } as any, { programId: DRIFT_PROGRAM_ID, candidateMultisigs: [DRIFT_MULTISIG] })
    ).rejects.toThrow(/multisig account not found/);
  });
});
