// File: apps/worker/src/positions/resolve.ts
//
// Wallet position resolver (arch/D-web.md, Phase 4 SCOPE: GET
// /api/v1/positions/:wallet). Implemented here (worker), not in the web
// layer, per the coordinator's split: the web route reads/writes the shared
// `positions` table; this module does the on-chain work.
//
// STATUS (honest, DEV-050): only SPL Token + Token-2022 token-account
// resolution is implemented and tested this phase. It is a real, general
// getProgramAccounts(memcmp on the owner field) scan against both token
// programs — no protocol-specific IDL needed, so no external citation is
// required beyond the SPL Token account layout, which is part of the
// Solana Program Library spec (owner: bytes 32..64 of a 165-byte token
// account; https://spl.solana.com/token#account-layout).
//
// NOT implemented this phase (BLOCKED — see BUILD-REPORT DEV log): Raydium
// CLMM / Orca Whirlpool position NFTs, Kamino obligations, marginfi
// accounts, and Drift users. Each needs that protocol's real account
// discriminator and field offsets pulled from its own repo (the task's
// instruction to fetch them "via gh api, cited"), which this session did
// not have time to do without guessing at bytes — guessing here would
// silently corrup a wallet's displayed exposure, so each resolver below is
// a stub that returns an empty list rather than fabricated data.

import { Connection, PublicKey } from '@solana/web3.js';
import { resolveRpcEndpoints, withRedaction } from '../ingest/rpc';

export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

// Real, publicly-known program ids for the protocols named in scope. Kept
// here (even though their position decoders are stubs) so the resolver's
// shape is future-proof and the ids are documented in one place.
export const PROTOCOL_PROGRAM_IDS = {
  raydiumClmm: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  orcaWhirlpool: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  kaminoLending: 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD',
  marginfi: 'MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA',
  driftV2: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',
} as const;

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

  // `getProgramAccounts` with only a memcmp filter forces the RPC to scan
  // every account on the token program (Token-2022 accounts vary in size,
  // so a `dataSize` filter can't narrow it either) — Helius rejects that as
  // too expensive ("Too many accounts requested"). `getParsedTokenAccountsByOwner`
  // is the RPC method built for exactly this lookup (it's backed by the
  // validator's owner-indexed token account cache, not a raw table scan).
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

/** Stubs for protocols whose account layouts were not sourced this phase (see file header). */
export async function resolveRaydiumClmmPositions(_wallet: string): Promise<never[]> {
  return [];
}
export async function resolveOrcaWhirlpoolPositions(_wallet: string): Promise<never[]> {
  return [];
}
export async function resolveKaminoObligations(_wallet: string): Promise<never[]> {
  return [];
}
export async function resolveMarginfiAccounts(_wallet: string): Promise<never[]> {
  return [];
}
export async function resolveDriftUsers(_wallet: string): Promise<never[]> {
  return [];
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

  const tokenAccounts = await withRedaction(() => resolveTokenAccounts(connection, wallet));

  return tokenAccounts.map((t) => ({
    protocolId: t.protocolId,
    kind: t.kind,
    valueUsd: null, // no price oracle wired this phase
    detail: { mint: t.mint, amountRaw: t.amountRaw, decimals: t.decimals, tokenProgram: t.tokenProgram },
  }));
}
