// File: apps/worker/src/ingest/rpc.ts
//
// RPC/WS endpoint resolution for the ingest service. Mirrors the pattern in
// apps/worker/src/backfill/drift.ts: prefer Helius (keyed via ~/.helius_key,
// read from disk only, never logged) when the key file exists, else fall
// back to the public mainnet RPC. The key is never printed and any error
// message that might contain it is redacted before it propagates or is
// logged (DEV rule: NEVER print the API key).

import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HELIUS_KEY_PATH = path.join(os.homedir(), '.helius_key');

function readHeliusKey(): string | undefined {
  if (!existsSync(HELIUS_KEY_PATH)) return undefined;
  const key = readFileSync(HELIUS_KEY_PATH, 'utf8').trim();
  return key.length > 0 ? key : undefined;
}

export interface ResolvedEndpoints {
  httpUrl: string;
  wsUrl: string;
  usingHelius: boolean;
}

/**
 * Resolves the HTTP and WebSocket RPC endpoints for the poller source.
 * `DRIFT_BACKFILL_RPC`-style overrides are intentionally not reused here;
 * this module owns its own override so the ingest path can be pointed at a
 * different endpoint (e.g. a test double) independent of backfill.
 */
export function resolveRpcEndpoints(): ResolvedEndpoints {
  const httpOverride = process.env.INGEST_RPC_URL;
  const wsOverride = process.env.INGEST_WS_URL;
  if (httpOverride && wsOverride) {
    return { httpUrl: httpOverride, wsUrl: wsOverride, usingHelius: httpOverride.includes('helius') };
  }
  const key = readHeliusKey();
  if (key) {
    return {
      httpUrl: `https://mainnet.helius-rpc.com/?api-key=${key}`,
      wsUrl: `wss://mainnet.helius-rpc.com/?api-key=${key}`,
      usingHelius: true,
    };
  }
  return {
    httpUrl: 'https://api.mainnet-beta.solana.com',
    wsUrl: 'wss://api.mainnet-beta.solana.com',
    usingHelius: false,
  };
}

/** Strips the Helius key from a message before it is ever logged or thrown. */
export function redact(message: string): string {
  const key = readHeliusKey();
  if (!key) return message;
  return message.split(key).join('[REDACTED]');
}

/** Wraps a function so any thrown error has the API key redacted from its message. */
export async function withRedaction<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Error) {
      err.message = redact(err.message);
    }
    throw err;
  }
}
