// File: apps/worker/src/positions/resolve.ts
//
// Wallet position resolver (arch/D-web.md, Phase 4 SCOPE: GET
// /api/v1/positions/:wallet). Implemented here (worker), not in the web
// layer, per the coordinator's split: the web route reads/writes the shared
// `positions` table; this module does the on-chain work.
//
// STATUS (DEV-054 honesty rule): all six resolvers below are real —
// SPL/Token-2022 token accounts, plus the five protocol-specific position
// resolvers that were stubs at the end of Phase 4a. Each protocol-specific
// resolver's account discriminator and owner/authority field offset was
// read from that protocol's own source repo via `gh api` (cited per
// resolver below) and independently verified against a real mainnet
// account fetched through Helius before being hard-coded here — see
// apps/worker/src/positions/fixtures/*.json for the fetched bytes and the
// exact verification method for each one.
//
// Kamino, marginfi and Drift accounts carry the wallet directly (owner /
// authority field), so those three are resolved with a single
// getProgramAccounts call: memcmp on the Anchor account discriminator
// (bytes 0..8) plus memcmp on the owner/authority field at its offset.
// Raydium CLMM and Orca Whirlpool positions are NOT keyed by wallet at all
// — they're keyed by a position NFT mint, and the position PDA is
// `["position", nft_mint]` under the protocol's program. So those two are
// resolved the other way around: find the wallet's Token/Token-2022 NFTs
// (amount=1, decimals=0), derive each candidate PDA, and fetch it.

import { createHash } from 'node:crypto';
import { Connection, PublicKey } from '@solana/web3.js';
import { resolveRpcEndpoints, withRedaction } from '../ingest/rpc';

export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

export const PROTOCOL_PROGRAM_IDS = {
  raydiumClmm: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  orcaWhirlpool: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  kaminoLending: 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD',
  marginfi: 'MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA',
  driftV2: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',
} as const;

/** Anchor account discriminator: sha256("account:<Name>")[..8]. */
function anchorDiscriminator(name: string): Buffer {
  return createHash('sha256').update(`account:${name}`).digest().subarray(0, 8);
}

export interface TokenAccountPosition {
  wallet: string;
  protocolId: 'spl-token';
  kind: 'token_account';
  mint: string;
  amountRaw: string;
  decimals: number;
  tokenProgram: 'token' | 'token-2022';
}

/**
 * Real SPL/Token-2022 token accounts for `wallet`, via getProgramAccounts
 * with a memcmp filter on the owner field (offset 32) — no discriminator
 * needed for the legacy account layout.
 */
export async function resolveTokenAccounts(
  connection: Connection,
  wallet: string
): Promise<TokenAccountPosition[]> {
  const owner = new PublicKey(wallet);
  const results: TokenAccountPosition[] = [];

  for (const [programId, label] of [
    [TOKEN_PROGRAM_ID, 'token'],
    [TOKEN_2022_PROGRAM_ID, 'token-2022'],
  ] as const) {
    const { value: accounts } = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: new PublicKey(programId),
    });

    for (const acc of accounts) {
      const parsed = (acc.account.data as { parsed?: { info?: Record<string, unknown> } }).parsed;
      const info = parsed?.info;
      if (!info) continue;
      const tokenAmount = info.tokenAmount as { amount: string; decimals: number } | undefined;
      if (!tokenAmount || tokenAmount.amount === '0') continue;
      results.push({
        wallet,
        protocolId: 'spl-token',
        kind: 'token_account',
        mint: String(info.mint),
        amountRaw: tokenAmount.amount,
        decimals: tokenAmount.decimals,
        tokenProgram: label,
      });
    }
  }

  return results;
}

/** Generic shape every protocol resolver below returns. */
export interface ProtocolPosition {
  protocol: string;
  programId: string;
  kind: 'obligation' | 'margin_account' | 'user' | 'lp_position';
  account: string;
  evidence: Record<string, unknown>;
}

/**
 * Kamino Lend — Obligation.owner.
 *
 * Source: Kamino-Finance/klend @ a08760976f51a3a58c4a0c6ea27b4a0e565bca79,
 * programs/klend/src/state/obligation.rs — `pub struct Obligation` is
 * `#[account(zero_copy)] #[repr(C)]` with fields, in order:
 *   tag: u64 (8)
 *   last_update: LastUpdate (16 — see state/last_update.rs: u64 + u8 + u8 +
 *     [u8;2] + u32, all naturally aligned to 8)
 *   lending_market: Pubkey (32)
 *   owner: Pubkey (32)
 * so `owner` sits at byte offset 8 (tag) + 16 (last_update) + 32
 * (lending_market) = 56 within the struct, i.e. offset 64 in the raw
 * account (after the 8-byte Anchor discriminator). OBLIGATION_SIZE = 3336
 * (programs/klend/src/utils/consts.rs), so the full account (with
 * discriminator) is 3344 bytes.
 *
 * Verified live: querying with dataSize=3344 + memcmp(0, disc) returned
 * account JEJvqMqwyk2XGonDNfX4pPLNtKZCgxDJZP83YDWrxmjM with bytes[64..96]
 * decoding to H8wmwTGH6ddiAKN64GNhdhKimhBMmr8TxnMuG8QGi9e5; re-querying with
 * an added memcmp(64, that pubkey) returned exactly that one account back
 * (2026-09-26, Helius mainnet).
 */
const KAMINO_OBLIGATION_DISCRIMINATOR = anchorDiscriminator('Obligation');
const KAMINO_OBLIGATION_SIZE = 3344;
const KAMINO_OBLIGATION_OWNER_OFFSET = 64;

export async function resolveKaminoObligations(
  connection: Connection,
  wallet: string
): Promise<ProtocolPosition[]> {
  const owner = new PublicKey(wallet);
  const accounts = await connection.getProgramAccounts(new PublicKey(PROTOCOL_PROGRAM_IDS.kaminoLending), {
    filters: [
      { dataSize: KAMINO_OBLIGATION_SIZE },
      { memcmp: { offset: 0, bytes: KAMINO_OBLIGATION_DISCRIMINATOR.toString('base64'), encoding: 'base64' } },
      { memcmp: { offset: KAMINO_OBLIGATION_OWNER_OFFSET, bytes: owner.toBase58() } },
    ],
  });

  return accounts.map(({ pubkey }) => ({
    protocol: 'kamino-lend',
    programId: PROTOCOL_PROGRAM_IDS.kaminoLending,
    kind: 'obligation' as const,
    account: pubkey.toBase58(),
    evidence: {
      ownerOffset: KAMINO_OBLIGATION_OWNER_OFFSET,
      dataSize: KAMINO_OBLIGATION_SIZE,
      source: 'Kamino-Finance/klend@a08760976f51a3a58c4a0c6ea27b4a0e565bca79:programs/klend/src/state/obligation.rs',
    },
  }));
}

/**
 * marginfi v2 — MarginfiAccount.authority.
 *
 * Source: 0dotxyz/marginfi-v2 (the mrgnlabs/marginfi-v2 repo now redirects
 * here) @ 35b5c66aa6897c43e7199bd6c598134041e89f99,
 * type-crate/src/types/user_account.rs — `pub struct MarginfiAccount` is a
 * plain Borsh `#[account]` struct whose first two fields are `group:
 * Pubkey` (32) then `authority: Pubkey` (32), so `authority` sits at struct
 * offset 32, i.e. raw account offset 40 (after the 8-byte discriminator).
 *
 * Verified live: querying with memcmp(0, disc) only (Helius accepted this
 * without a dataSize filter) returned account
 * JEGPjdYoDws6EictqdReHvm64vVAAiZURVDQTL5BMRXQ (space=2312) with
 * bytes[40..72] decoding to BTyZ7QBm1zMzCCvng2nwr6i3ADVPQWS8PirDk9CA3znY;
 * re-querying with dataSize=2312 + memcmp(40, that pubkey) returned exactly
 * that one account back (2026-09-26, Helius mainnet).
 */
const MARGINFI_ACCOUNT_DISCRIMINATOR = anchorDiscriminator('MarginfiAccount');
const MARGINFI_ACCOUNT_SIZE = 2312;
const MARGINFI_AUTHORITY_OFFSET = 40;

export async function resolveMarginfiAccounts(
  connection: Connection,
  wallet: string
): Promise<ProtocolPosition[]> {
  const authority = new PublicKey(wallet);
  const accounts = await connection.getProgramAccounts(new PublicKey(PROTOCOL_PROGRAM_IDS.marginfi), {
    filters: [
      { dataSize: MARGINFI_ACCOUNT_SIZE },
      { memcmp: { offset: 0, bytes: MARGINFI_ACCOUNT_DISCRIMINATOR.toString('base64'), encoding: 'base64' } },
      { memcmp: { offset: MARGINFI_AUTHORITY_OFFSET, bytes: authority.toBase58() } },
    ],
  });

  return accounts.map(({ pubkey }) => ({
    protocol: 'marginfi',
    programId: PROTOCOL_PROGRAM_IDS.marginfi,
    kind: 'margin_account' as const,
    account: pubkey.toBase58(),
    evidence: {
      authorityOffset: MARGINFI_AUTHORITY_OFFSET,
      dataSize: MARGINFI_ACCOUNT_SIZE,
      source: '0dotxyz/marginfi-v2@35b5c66aa6897c43e7199bd6c598134041e89f99:type-crate/src/types/user_account.rs',
    },
  }));
}

/**
 * Drift v2 — User.authority.
 *
 * Source: velocity-exchange/protocol-v2 (drift-labs/protocol-v2 now
 * redirects here) @ 13e8e9b8d614f3b62e3a65a8c372c819e6529aeb,
 * programs/drift/src/state/user.rs — `pub struct User` has `authority:
 * Pubkey` as its very first field, so it sits at struct offset 0, i.e. raw
 * account offset 8 (right after the discriminator).
 *
 * Verified live: querying with memcmp(0, disc) returned account
 * JEGbXkUWyXeQ6s3zYLAMr63VoHSXFev9Swuia3Zxwsgr (space=4376) with
 * bytes[8..40] decoding to HHVQnKkXSq3xKYviLpig8Rg4pLQ2J9QFsHNfggHNohuF;
 * re-querying with dataSize=4376 + memcmp(8, that pubkey) returned exactly
 * that one account back (2026-09-26, Helius mainnet).
 */
const DRIFT_USER_DISCRIMINATOR = anchorDiscriminator('User');
const DRIFT_USER_SIZE = 4376;
const DRIFT_USER_AUTHORITY_OFFSET = 8;

export async function resolveDriftUsers(connection: Connection, wallet: string): Promise<ProtocolPosition[]> {
  const authority = new PublicKey(wallet);
  const accounts = await connection.getProgramAccounts(new PublicKey(PROTOCOL_PROGRAM_IDS.driftV2), {
    filters: [
      { dataSize: DRIFT_USER_SIZE },
      { memcmp: { offset: 0, bytes: DRIFT_USER_DISCRIMINATOR.toString('base64'), encoding: 'base64' } },
      { memcmp: { offset: DRIFT_USER_AUTHORITY_OFFSET, bytes: authority.toBase58() } },
    ],
  });

  return accounts.map(({ pubkey }) => ({
    protocol: 'drift-v2',
    programId: PROTOCOL_PROGRAM_IDS.driftV2,
    kind: 'user' as const,
    account: pubkey.toBase58(),
    evidence: {
      authorityOffset: DRIFT_USER_AUTHORITY_OFFSET,
      dataSize: DRIFT_USER_SIZE,
      source: 'velocity-exchange/protocol-v2@13e8e9b8d614f3b62e3a65a8c372c819e6529aeb:programs/drift/src/state/user.rs',
    },
  }));
}

/**
 * Finds a wallet's Token + Token-2022 NFTs (amount=1, decimals=0) — the
 * shared first step for both LP-position resolvers below, since neither
 * Raydium CLMM's PersonalPositionState nor Orca's Position account carries
 * the owning wallet; each is only reachable via the NFT that represents it.
 */
async function walletNftMints(connection: Connection, wallet: string): Promise<PublicKey[]> {
  const owner = new PublicKey(wallet);
  const mints: PublicKey[] = [];
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const { value: accounts } = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: new PublicKey(programId),
    });
    for (const acc of accounts) {
      const info = (acc.account.data as { parsed?: { info?: Record<string, unknown> } }).parsed?.info;
      const tokenAmount = info?.tokenAmount as { amount: string; decimals: number } | undefined;
      if (info && tokenAmount && tokenAmount.decimals === 0 && tokenAmount.amount === '1') {
        mints.push(new PublicKey(String(info.mint)));
      }
    }
  }
  return mints;
}

/**
 * Raydium CLMM — PersonalPositionState, found from the wallet's position
 * NFTs via PDA `["position", nft_mint]`.
 *
 * Source: raydium-io/raydium-clmm @ ed7c84a54ced59c55981780546adb0b4583dcf85,
 * programs/amm/src/states/personal_position.rs — `pub struct
 * PersonalPositionState` is a plain Borsh `#[account]` struct: `bump:
 * [u8;1]` (1) then `nft_mint: Pubkey` (32), so `nft_mint` sits at struct
 * offset 1, i.e. raw account offset 9.
 *
 * Verified live: a real position found via memcmp(0, disc) alone
 * (JEKJVBcKG4vWhxXXKd8c4XyVNUHFSWd12Fc94JyenGF4) had bytes[9..41] decoding
 * to mint B2T1tZAdCQU56JWaAcbp6gS9qv9dkcwS9jbycAgJwhNq; deriving PDA
 * `["position", mint]` under the CAMM program id reproduced that exact
 * pubkey; `getTokenLargestAccounts(mint)` -> `getAccountInfo` on that
 * token account gave owner kN1kEznaF5Xbd8LYuqtEFcxzWSBk5Fv6ygX6SqEGJVy
 * (2026-09-26, Helius mainnet).
 */
const RAYDIUM_POSITION_DISCRIMINATOR = anchorDiscriminator('PersonalPositionState');

export async function resolveRaydiumClmmPositions(
  connection: Connection,
  wallet: string
): Promise<ProtocolPosition[]> {
  const mints = await walletNftMints(connection, wallet);
  const programId = new PublicKey(PROTOCOL_PROGRAM_IDS.raydiumClmm);
  const results: ProtocolPosition[] = [];

  for (const mint of mints) {
    const [pda] = PublicKey.findProgramAddressSync([Buffer.from('position'), mint.toBuffer()], programId);
    const info = await connection.getAccountInfo(pda);
    if (!info || !info.owner.equals(programId)) continue;
    if (!info.data.subarray(0, 8).equals(RAYDIUM_POSITION_DISCRIMINATOR)) continue;

    results.push({
      protocol: 'raydium-clmm',
      programId: PROTOCOL_PROGRAM_IDS.raydiumClmm,
      kind: 'lp_position' as const,
      account: pda.toBase58(),
      evidence: {
        nftMint: mint.toBase58(),
        pdaSeeds: ['position', mint.toBase58()],
        source: 'raydium-io/raydium-clmm@ed7c84a54ced59c55981780546adb0b4583dcf85:programs/amm/src/states/personal_position.rs',
      },
    });
  }

  return results;
}

/**
 * Orca Whirlpool — Position, found from the wallet's position NFTs via PDA
 * `["position", nft_mint]`.
 *
 * Source: orca-so/whirlpools @ 408c945fef4c49ab70def4303377cfaf8f0f3c99,
 * programs/whirlpool/src/state/position.rs — `pub struct Position` is a
 * plain Borsh `#[account]` struct: `whirlpool: Pubkey` (32) then
 * `position_mint: Pubkey` (32), so `position_mint` sits at struct offset
 * 32, i.e. raw account offset 40.
 *
 * Verified live: a real position found via memcmp(0, disc) alone
 * (JEHA4MmrhWxZPQoJSZrQxkBsiuuq5WwnbyZHoRYbuyRx) had bytes[40..72] decoding
 * to mint Bm4gqMxV7HUp3C6edraVyPLMCpraG38X2jQC8zALXLY4; deriving PDA
 * `["position", mint]` under the Whirlpool program id reproduced that exact
 * pubkey; the mint is a Token-2022 NFT (immutableOwner extension);
 * `getTokenLargestAccounts(mint)` -> `getAccountInfo` on that token
 * account gave owner 6t695gArJ71cCWJ4W5huVndpPm2WwVQ33AAdcgQf3wUP
 * (2026-09-26, Helius mainnet).
 */
const ORCA_POSITION_DISCRIMINATOR = anchorDiscriminator('Position');

export async function resolveOrcaWhirlpoolPositions(
  connection: Connection,
  wallet: string
): Promise<ProtocolPosition[]> {
  const mints = await walletNftMints(connection, wallet);
  const programId = new PublicKey(PROTOCOL_PROGRAM_IDS.orcaWhirlpool);
  const results: ProtocolPosition[] = [];

  for (const mint of mints) {
    const [pda] = PublicKey.findProgramAddressSync([Buffer.from('position'), mint.toBuffer()], programId);
    const info = await connection.getAccountInfo(pda);
    if (!info || !info.owner.equals(programId)) continue;
    if (!info.data.subarray(0, 8).equals(ORCA_POSITION_DISCRIMINATOR)) continue;

    results.push({
      protocol: 'orca-whirlpool',
      programId: PROTOCOL_PROGRAM_IDS.orcaWhirlpool,
      kind: 'lp_position' as const,
      account: pda.toBase58(),
      evidence: {
        nftMint: mint.toBase58(),
        pdaSeeds: ['position', mint.toBase58()],
        source: 'orca-so/whirlpools@408c945fef4c49ab70def4303377cfaf8f0f3c99:programs/whirlpool/src/state/position.rs',
      },
    });
  }

  return results;
}

/**
 * Resolves everything currently implemented for a wallet. Returns the
 * generic shape the `positions` table stores (see apps/worker/src/schema.ts).
 */
export async function resolveWalletPositions(wallet: string): Promise<
  Array<{ protocolId: string; kind: string; valueUsd: string | null; detail: Record<string, unknown> }>
> {
  const endpoints = resolveRpcEndpoints();
  const connection = new Connection(endpoints.httpUrl, 'confirmed');

  const [tokenAccounts, obligations, marginfiAccounts, driftUsers, raydiumPositions, orcaPositions] =
    await withRedaction(() =>
      Promise.all([
        resolveTokenAccounts(connection, wallet),
        resolveKaminoObligations(connection, wallet),
        resolveMarginfiAccounts(connection, wallet),
        resolveDriftUsers(connection, wallet),
        resolveRaydiumClmmPositions(connection, wallet),
        resolveOrcaWhirlpoolPositions(connection, wallet),
      ])
    );

  const protocolPositions = [...obligations, ...marginfiAccounts, ...driftUsers, ...raydiumPositions, ...orcaPositions].map(
    (p) => ({
      protocolId: p.protocol,
      kind: p.kind,
      valueUsd: null, // no price oracle wired this phase
      detail: { account: p.account, programId: p.programId, evidence: p.evidence },
    })
  );

  return [
    ...tokenAccounts.map((t) => ({
      protocolId: t.protocolId,
      kind: t.kind,
      valueUsd: null, // no price oracle wired this phase
      detail: { mint: t.mint, amountRaw: t.amountRaw, decimals: t.decimals, tokenProgram: t.tokenProgram },
    })),
    ...protocolPositions,
  ];
}
