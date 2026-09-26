// File: apps/worker/src/ingest/yellowstone.ts
//
// [DESIGNED + BUILT, disabled at runtime — see below]
//
// Triton Yellowstone (Dragon's Mouth) gRPC ingest source, built against the
// real @triton-one/yellowstone-grpc 7.0.1 types (apps/worker/node_modules/
// @triton-one/yellowstone-grpc/dist/types/{index,grpc/geyser}.d.ts read
// directly for this task — the client's default export is `Client`, not
// `GeyserClient`, and `SubscribeRequest.transactions`/`.accounts` are
// string-keyed maps, not arrays; PLAN.md's illustrative snippet used a
// different, non-existent shape).
//
// No YELLOWSTONE_TOKEN exists yet (just-in-time credential, per the forge
// PULSE.md decision and this task's brief). `createYellowstoneSource`
// throws YellowstoneDisabledError when the token is absent, and logs this
// clearly at startup — it is never silently swapped for a mock in any demo
// path. `apps/worker/src/ingest/index.ts` treats this as an expected,
// logged-and-skipped source until the token is provisioned; `poller.ts` is
// the source that carries ingest today.

import Client, {
  CommitmentLevel,
  type SubscribeRequest,
  type SubscribeUpdate,
} from '@triton-one/yellowstone-grpc';
import bs58 from 'bs58';
import type { IngestCandidate, RawInstruction } from './types';

export class YellowstoneDisabledError extends Error {
  constructor(reason: string) {
    super(`Yellowstone stream disabled: ${reason}`);
    this.name = 'YellowstoneDisabledError';
  }
}

export interface YellowstoneConfig {
  endpoint?: string;
  token?: string;
  programIds: string[];
}

/** Builds the SubscribeRequest for the watched program IDs. Pure, unit-testable. */
export function buildSubscribeRequest(programIds: string[]): SubscribeRequest {
  return {
    accounts: {},
    slots: {},
    transactions: {
      keyholder_ingest: {
        vote: false,
        failed: false,
        accountInclude: programIds,
        accountExclude: [],
        accountRequired: [],
      },
    },
    transactionsStatus: {},
    blocks: {},
    blocksMeta: {},
    entry: {},
    accountsDataSlice: [],
    ping: undefined,
    commitment: CommitmentLevel.CONFIRMED,
  } as unknown as SubscribeRequest;
}

/**
 * Returns the resolved config if the stream can be enabled, or throws
 * YellowstoneDisabledError with a clear, non-secret reason otherwise. Never
 * reads YELLOWSTONE_TOKEN from anywhere but process.env, and never logs its
 * value.
 */
export function resolveYellowstoneConfig(programIds: string[]): YellowstoneConfig {
  const endpoint = process.env.YELLOWSTONE_ENDPOINT;
  const token = process.env.YELLOWSTONE_TOKEN;
  if (!endpoint || !token) {
    throw new YellowstoneDisabledError(
      'YELLOWSTONE_ENDPOINT/YELLOWSTONE_TOKEN not set (just-in-time credential, not yet provisioned)'
    );
  }
  return { endpoint, token, programIds };
}

/**
 * Connects and subscribes. Only called once resolveYellowstoneConfig has
 * succeeded. Returns the live duplex stream; caller is responsible for
 * consuming it (see `consumeYellowstoneStream`) and for closing it on
 * shutdown.
 */
export async function connectYellowstone(config: YellowstoneConfig) {
  if (!config.endpoint || !config.token) {
    throw new YellowstoneDisabledError('connectYellowstone called without endpoint/token');
  }
  const client = new Client(config.endpoint, config.token, undefined);
  const request = buildSubscribeRequest(config.programIds);
  const stream = await client.subscribe(request);
  stream.write(request as unknown as SubscribeRequest);
  return stream;
}

/**
 * Normalizes a raw SubscribeUpdate transaction event into an
 * IngestCandidate. Instruction extraction reads the compiled instructions
 * off `transaction.transaction.message` (legacy or v0), resolving program
 * IDs via the account-keys table (including loaded address-lookup-table
 * addresses, which live on `meta.loadedWritableAddresses` /
 * `loadedReadonlyAddresses`).
 */
export function normalizeYellowstoneUpdate(update: SubscribeUpdate): IngestCandidate | null {
  const txUpdate = update.transaction;
  if (!txUpdate?.transaction) return null;
  const info = txUpdate.transaction;
  const message = info.transaction?.message;
  if (!message) return null;

  const staticKeys = (message.accountKeys ?? []).map((k) => bs58.encode(k));
  const loadedWritable = (info.meta?.loadedWritableAddresses ?? []).map((k) => bs58.encode(k));
  const loadedReadonly = (info.meta?.loadedReadonlyAddresses ?? []).map((k) => bs58.encode(k));
  const allKeys = [...staticKeys, ...loadedWritable, ...loadedReadonly];

  const numSigners = message.header?.numRequiredSignatures ?? 0;
  const instructions: RawInstruction[] = (message.instructions ?? []).map((ix) => {
    const programId = allKeys[ix.programIdIndex] ?? '';
    const accounts = Array.from(ix.accounts ?? new Uint8Array()).map((idx) => ({
      pubkey: allKeys[idx] ?? '',
      isSigner: idx < numSigners,
    }));
    return { programId, data: Buffer.from(ix.data ?? new Uint8Array()), accounts };
  });

  return {
    signature: info.signature ? bs58.encode(info.signature) : '',
    slot: Number(txUpdate.slot),
    blockTime: null, // Yellowstone transaction updates do not carry blockTime; resolved by the state builder from slot.
    commitment: 'confirmed',
    source: 'yellowstone',
    instructions,
    raw: update,
  };
}
