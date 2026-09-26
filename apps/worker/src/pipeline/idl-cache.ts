// File: apps/worker/src/pipeline/idl-cache.ts
//
// In-memory memoization over @keyholder/decoder's discoverIdl (Program
// Metadata canonical IDL, then legacy Anchor IDL account — both live network
// reads). The decode stage runs on a poll loop and re-decodes many
// instructions per program per tick; without a cache each one would re-fetch
// the same IDL account over RPC. Never invents an IDL: a program with
// neither IDL source is cached as `null` and stays undecoded, honestly, for
// the process lifetime (an operator can restart the worker to re-check if a
// program adds an IDL later).

import type { Connection } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { discoverIdl, type DiscoveredIdl } from '@keyholder/decoder';

export interface IdlCache {
  get(programId: string): Promise<DiscoveredIdl | null>;
}

export function createIdlCache(connection: Connection): IdlCache {
  const cache = new Map<string, Promise<DiscoveredIdl | null>>();

  return {
    get(programId: string): Promise<DiscoveredIdl | null> {
      const cached = cache.get(programId);
      if (cached) return cached;
      const promise = discoverIdl(new PublicKey(programId), connection).catch(() => null);
      cache.set(programId, promise);
      return promise;
    },
  };
}
