import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { Keypair, PublicKey } from '@solana/web3.js';
import { deriveSquadsVaultPda, SQUADS_V4_PROGRAM_ID } from '@keyholder/decoder';
import { resolveControlAccounts, VERIFIED_SEED_TARGETS, type SeedTarget } from './registry';

/** Builds a synthetic-but-layout-correct ProgramData account buffer (see byte-parser.ts's documented layout). */
function buildProgramDataBuffer(authority: PublicKey | null): Buffer {
  const buf = Buffer.alloc(authority ? 45 : 13);
  buf.writeUInt32LE(3, 0); // ProgramData tag
  buf.writeBigUInt64LE(999n, 4); // lastDeploySlot
  if (authority) {
    buf.writeUInt8(1, 12);
    authority.toBuffer().copy(buf, 13);
  } else {
    buf.writeUInt8(0, 12);
  }
  return buf;
}

/** Builds a synthetic-but-layout-correct Squads v4 Multisig account buffer. */
function buildMultisigBuffer(threshold: number, timeLock: number, memberKeys: PublicKey[]): Buffer {
  const disc = createHash('sha256').update('account:Multisig').digest().subarray(0, 8);
  const head = Buffer.alloc(94 + 1 + 1 + 4); // fixed fields + rent_collector tag(None) + bump + member count
  disc.copy(head, 0);
  Buffer.alloc(32).copy(head, 8); // createKey
  Buffer.alloc(32).copy(head, 40); // configAuthority
  head.writeUInt16LE(threshold, 72);
  head.writeUInt32LE(timeLock, 74);
  head.writeBigUInt64LE(0n, 78);
  head.writeBigUInt64LE(0n, 86);
  head.writeUInt8(0, 94); // rent_collector = None
  head.writeUInt8(0, 95); // bump
  head.writeUInt32LE(memberKeys.length, 96);
  const members = Buffer.concat(memberKeys.map((k) => Buffer.concat([k.toBuffer(), Buffer.from([1])])));
  return Buffer.concat([head, members]);
}

describe('VERIFIED_SEED_TARGETS', () => {
  it('contains exactly the Drift entry confirmed in PULSE.md (REAL ONLY — no invented addresses)', () => {
    expect(VERIFIED_SEED_TARGETS).toHaveLength(1);
    expect(VERIFIED_SEED_TARGETS[0].protocolId).toBe('drift');
    expect(VERIFIED_SEED_TARGETS[0].programId).toBe('dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH');
  });
});

describe('resolveControlAccounts (mocked connection — layout logic only, no live RPC)', () => {
  it('resolves a Squads-vault upgrade authority to its multisig config', async () => {
    const multisigPk = new PublicKey('7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM');
    const vaultPda = deriveSquadsVaultPda(multisigPk, 0, new PublicKey(SQUADS_V4_PROGRAM_ID));

    const programDataBuf = buildProgramDataBuffer(vaultPda);
    const multisigBuf = buildMultisigBuffer(4, 3600, [multisigPk]);

    const target: SeedTarget = {
      protocolId: 'drift',
      protocolName: 'Drift Protocol',
      programId: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',
      candidateMultisigs: [multisigPk.toBase58()],
    };

    const getAccountInfo = vi.fn(async (pk: PublicKey) => {
      if (pk.equals(multisigPk)) return { data: multisigBuf } as any;
      return { data: programDataBuf } as any;
    });
    const fakeConnection = { getAccountInfo } as any;

    const result = await resolveControlAccounts(fakeConnection, target);
    expect(result.authorityKind).toBe('squads_vault');
    expect(result.multisig?.address).toBe(multisigPk.toBase58());
    expect(result.multisig?.threshold).toBe(4);
    expect(result.multisig?.timeLockS).toBe(3600);
  });

  it('reports immutable when ProgramData has no upgrade authority', async () => {
    const programDataBuf = buildProgramDataBuffer(null);
    const target: SeedTarget = {
      protocolId: 'x',
      protocolName: 'X',
      programId: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',
    };
    const getAccountInfo = vi.fn(async () => ({ data: programDataBuf } as any));
    const result = await resolveControlAccounts({ getAccountInfo } as any, target);
    expect(result.authorityKind).toBe('immutable');
  });

  it('reports unresolved when the authority does not derive from any candidate multisig', async () => {
    const wallet = Keypair.generate().publicKey;
    const programDataBuf = buildProgramDataBuffer(wallet);
    const target: SeedTarget = {
      protocolId: 'x',
      protocolName: 'X',
      programId: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',
      candidateMultisigs: ['7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM'],
    };
    const getAccountInfo = vi.fn(async () => ({ data: programDataBuf } as any));
    const result = await resolveControlAccounts({ getAccountInfo } as any, target);
    expect(result.authorityKind).toBe('unresolved');
  });
});
