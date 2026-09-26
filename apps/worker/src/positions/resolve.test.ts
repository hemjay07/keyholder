// File: apps/worker/src/positions/resolve.test.ts
//
// Unit tests for the five protocol-specific position resolvers (Phase 4b).
// Each happy-path test replays a REAL mainnet account fetched via Helius
// (see fixtures/*.json for the exact wallet, method and fetch date) through
// a mocked Connection, so the parsing/offset logic is proven against real
// bytes rather than synthetic ones. Edge and error cases use synthetic
// buffers built to the same documented layout (same pattern as
// state-builder/authority.test.ts).

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  resolveKaminoObligations,
  resolveMarginfiAccounts,
  resolveDriftUsers,
  resolveRaydiumClmmPositions,
  resolveOrcaWhirlpoolPositions,
  PROTOCOL_PROGRAM_IDS,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from './resolve';

import kaminoFixture from './fixtures/kamino-obligation.json';
import marginfiFixture from './fixtures/marginfi-account.json';
import driftFixture from './fixtures/drift-user.json';
import raydiumFixture from './fixtures/raydium-clmm-position.json';
import orcaFixture from './fixtures/orca-whirlpool-position.json';

function disc(name: string): Buffer {
  return createHash('sha256').update(`account:${name}`).digest().subarray(0, 8);
}

/** A mock that answers getProgramAccounts with one fixture-shaped account, regardless of the filters passed. */
function mockGpaConnection(pubkey: string, dataBase64: string) {
  const getProgramAccounts = async () => [
    { pubkey: new PublicKey(pubkey), account: { data: Buffer.from(dataBase64, 'base64') } as any },
  ];
  return { getProgramAccounts } as unknown as Connection;
}

function mockEmptyGpaConnection() {
  const getProgramAccounts = async () => [];
  return { getProgramAccounts } as unknown as Connection;
}

describe('resolveKaminoObligations', () => {
  it('parses a real Obligation account and returns the owning wallet position (happy path)', async () => {
    const connection = mockGpaConnection(kaminoFixture.accountPubkey, kaminoFixture.dataBase64);
    const result = await resolveKaminoObligations(connection, kaminoFixture.owner);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      protocol: 'kamino-lend',
      programId: PROTOCOL_PROGRAM_IDS.kaminoLending,
      kind: 'obligation',
      account: kaminoFixture.accountPubkey,
    });
  });

  it('returns an empty list when the wallet holds no obligation (edge case)', async () => {
    const connection = mockEmptyGpaConnection();
    const result = await resolveKaminoObligations(connection, kaminoFixture.owner);
    expect(result).toEqual([]);
  });

  it('rejects a malformed wallet address (error case)', async () => {
    const connection = mockEmptyGpaConnection();
    await expect(resolveKaminoObligations(connection, 'not-a-pubkey')).rejects.toThrow();
  });
});

describe('resolveMarginfiAccounts', () => {
  it('parses a real MarginfiAccount and returns the owning wallet position (happy path)', async () => {
    const connection = mockGpaConnection(marginfiFixture.accountPubkey, marginfiFixture.dataBase64);
    const result = await resolveMarginfiAccounts(connection, marginfiFixture.owner);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      protocol: 'marginfi',
      programId: PROTOCOL_PROGRAM_IDS.marginfi,
      kind: 'margin_account',
      account: marginfiFixture.accountPubkey,
    });
  });

  it('returns an empty list when the wallet holds no marginfi account (edge case)', async () => {
    const connection = mockEmptyGpaConnection();
    const result = await resolveMarginfiAccounts(connection, marginfiFixture.owner);
    expect(result).toEqual([]);
  });

  it('rejects a malformed wallet address (error case)', async () => {
    const connection = mockEmptyGpaConnection();
    await expect(resolveMarginfiAccounts(connection, '')).rejects.toThrow();
  });
});

describe('resolveDriftUsers', () => {
  it('parses a real Drift User account and returns the owning wallet position (happy path)', async () => {
    const connection = mockGpaConnection(driftFixture.accountPubkey, driftFixture.dataBase64);
    const result = await resolveDriftUsers(connection, driftFixture.owner);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      protocol: 'drift-v2',
      programId: PROTOCOL_PROGRAM_IDS.driftV2,
      kind: 'user',
      account: driftFixture.accountPubkey,
    });
  });

  it('returns an empty list when the wallet holds no Drift user account (edge case)', async () => {
    const connection = mockEmptyGpaConnection();
    const result = await resolveDriftUsers(connection, driftFixture.owner);
    expect(result).toEqual([]);
  });

  it('rejects a malformed wallet address (error case)', async () => {
    const connection = mockEmptyGpaConnection();
    await expect(resolveDriftUsers(connection, 'nope')).rejects.toThrow();
  });
});

/** Mocks the NFT-discovery + PDA-fetch flow shared by Raydium CLMM and Orca Whirlpool. */
function mockNftPositionConnection(opts: {
  nftMint: string;
  nftProgramId: string;
  positionPubkey: string;
  positionDataBase64: string;
  positionOwnerProgramId: string;
}) {
  const getParsedTokenAccountsByOwner = async (_owner: PublicKey, config: { programId: PublicKey }) => {
    if (config.programId.toBase58() !== opts.nftProgramId) return { context: { slot: 0 }, value: [] };
    return {
      context: { slot: 0 },
      value: [
        {
          pubkey: new PublicKey(opts.positionPubkey), // arbitrary; not read
          account: {
            data: {
              parsed: {
                info: {
                  mint: opts.nftMint,
                  tokenAmount: { amount: '1', decimals: 0, uiAmount: 1 },
                },
              },
            },
          } as any,
        },
      ],
    };
  };
  const getAccountInfo = async (pk: PublicKey) => {
    if (pk.toBase58() !== opts.positionPubkey) return null;
    return {
      data: Buffer.from(opts.positionDataBase64, 'base64'),
      owner: new PublicKey(opts.positionOwnerProgramId),
    } as any;
  };
  return { getParsedTokenAccountsByOwner, getAccountInfo } as unknown as Connection;
}

describe('resolveRaydiumClmmPositions', () => {
  it('finds the position NFT, derives the PDA, and parses a real PersonalPositionState (happy path)', async () => {
    const connection = mockNftPositionConnection({
      nftMint: raydiumFixture.nftMint,
      nftProgramId: TOKEN_PROGRAM_ID,
      positionPubkey: raydiumFixture.accountPubkey,
      positionDataBase64: raydiumFixture.dataBase64,
      positionOwnerProgramId: PROTOCOL_PROGRAM_IDS.raydiumClmm,
    });

    const result = await resolveRaydiumClmmPositions(connection, raydiumFixture.owner);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      protocol: 'raydium-clmm',
      programId: PROTOCOL_PROGRAM_IDS.raydiumClmm,
      kind: 'lp_position',
      account: raydiumFixture.accountPubkey,
    });
    expect(result[0].evidence).toMatchObject({ nftMint: raydiumFixture.nftMint });
  });

  it('returns an empty list when the wallet holds no NFTs (edge case)', async () => {
    const connection = { getParsedTokenAccountsByOwner: async () => ({ context: { slot: 0 }, value: [] }) } as unknown as Connection;
    const result = await resolveRaydiumClmmPositions(connection, raydiumFixture.owner);
    expect(result).toEqual([]);
  });

  it('skips an NFT whose derived PDA is not owned by the CAMM program (error/defensive case)', async () => {
    const connection = mockNftPositionConnection({
      nftMint: raydiumFixture.nftMint,
      nftProgramId: TOKEN_PROGRAM_ID,
      positionPubkey: raydiumFixture.accountPubkey,
      positionDataBase64: raydiumFixture.dataBase64,
      positionOwnerProgramId: '11111111111111111111111111111111', // wrong owner: not the CAMM program
    });
    const result = await resolveRaydiumClmmPositions(connection, raydiumFixture.owner);
    expect(result).toEqual([]);
  });
});

describe('resolveOrcaWhirlpoolPositions', () => {
  it('finds the position NFT (Token-2022), derives the PDA, and parses a real Position (happy path)', async () => {
    const connection = mockNftPositionConnection({
      nftMint: orcaFixture.nftMint,
      nftProgramId: TOKEN_2022_PROGRAM_ID,
      positionPubkey: orcaFixture.accountPubkey,
      positionDataBase64: orcaFixture.dataBase64,
      positionOwnerProgramId: PROTOCOL_PROGRAM_IDS.orcaWhirlpool,
    });

    const result = await resolveOrcaWhirlpoolPositions(connection, orcaFixture.owner);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      protocol: 'orca-whirlpool',
      programId: PROTOCOL_PROGRAM_IDS.orcaWhirlpool,
      kind: 'lp_position',
      account: orcaFixture.accountPubkey,
    });
    expect(result[0].evidence).toMatchObject({ nftMint: orcaFixture.nftMint });
  });

  it('returns an empty list when the wallet holds no NFTs (edge case)', async () => {
    const connection = { getParsedTokenAccountsByOwner: async () => ({ context: { slot: 0 }, value: [] }) } as unknown as Connection;
    const result = await resolveOrcaWhirlpoolPositions(connection, orcaFixture.owner);
    expect(result).toEqual([]);
  });

  it('skips an NFT whose account data has the wrong discriminator (error/defensive case)', async () => {
    const badData = Buffer.from(orcaFixture.dataBase64, 'base64');
    disc('NotAPosition').copy(badData, 0); // corrupt the discriminator
    const connection = mockNftPositionConnection({
      nftMint: orcaFixture.nftMint,
      nftProgramId: TOKEN_2022_PROGRAM_ID,
      positionPubkey: orcaFixture.accountPubkey,
      positionDataBase64: badData.toString('base64'),
      positionOwnerProgramId: PROTOCOL_PROGRAM_IDS.orcaWhirlpool,
    });
    const result = await resolveOrcaWhirlpoolPositions(connection, orcaFixture.owner);
    expect(result).toEqual([]);
  });
});
