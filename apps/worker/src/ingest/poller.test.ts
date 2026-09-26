import { describe, it, expect, vi, afterEach } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { startPoller } from './poller';
import { BPF_LOADER_UPGRADEABLE_PROGRAM_ID } from '@keyholder/decoder';
import type { IngestCandidate } from './types';

const SIGNER = Keypair.generate().publicKey.toBase58();

/** A minimal fake matching the subset of web3.js Connection this module calls. */
function makeFakeConnection(opts: {
  signaturesByAddress?: Record<string, Array<{ signature: string; slot: number; err: unknown }>>;
  transactionsBySignature?: Record<string, unknown>;
}) {
  const onLogsHandlers: Array<(logs: { signature: string; err: unknown }) => void> = [];
  const onAccountChangeHandlers: Array<() => void> = [];
  return {
    calls: { getTransaction: 0, getSignaturesForAddress: 0 },
    onLogs(_pk: unknown, cb: (logs: { signature: string; err: unknown }) => void) {
      onLogsHandlers.push(cb);
      return onLogsHandlers.length;
    },
    onAccountChange(_pk: unknown, cb: () => void) {
      onAccountChangeHandlers.push(cb);
      return onAccountChangeHandlers.length;
    },
    removeOnLogsListener: vi.fn(async () => {}),
    removeAccountChangeListener: vi.fn(async () => {}),
    async getSignaturesForAddress(pk: { toBase58: () => string }) {
      return opts.signaturesByAddress?.[pk.toBase58()] ?? [];
    },
    async getTransaction(sig: string) {
      return opts.transactionsBySignature?.[sig] ?? null;
    },
    emitLogs(signature: string, err: unknown = null) {
      for (const h of onLogsHandlers) h({ signature, err });
    },
  };
}

function fakeTx(programId: string, dataTag: number, slot: number) {
  const data = Buffer.alloc(4);
  data.writeUInt32LE(dataTag, 0);
  return {
    slot,
    blockTime: Math.floor(Date.now() / 1000),
    transaction: {
      message: {
        getAccountKeys: () => ({
          get: (i: number) => (i === 0 ? { toBase58: () => SIGNER } : { toBase58: () => programId }),
        }),
        isAccountSigner: (i: number) => i === 0,
        compiledInstructions: [{ programIdIndex: 1, accountKeyIndexes: [0], data }],
      },
    },
    meta: { innerInstructions: [], loadedAddresses: undefined },
  };
}

describe('startPoller reconciliation (mocked connection, no live network)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fetches, filters, and emits a kept candidate found via getSignaturesForAddress', async () => {
    const watchedAddress = Keypair.generate().publicKey.toBase58();
    const sig = 'sig-upgrade-1';
    const conn = makeFakeConnection({
      signaturesByAddress: { [watchedAddress]: [{ signature: sig, slot: 500, err: null }] },
      transactionsBySignature: { [sig]: fakeTx(BPF_LOADER_UPGRADEABLE_PROGRAM_ID, 3, 500) },
    });

    const emitted: IngestCandidate[] = [];
    const handle = startPoller({
      connection: conn as any,
      watchedProgramIds: [BPF_LOADER_UPGRADEABLE_PROGRAM_ID],
      watchedAccounts: [watchedAddress],
      filter: { trackedProgramIds: new Set(), watchedSigners: new Set() },
      onCandidate: (c) => {
        emitted.push(c);
      },
      reconcileIntervalMs: 10_000_000, // don't fire the interval during the test
    });

    // reconcileOnce() runs once immediately (fire-and-forget); flush microtasks.
    await new Promise((r) => setTimeout(r, 20));

    expect(emitted).toHaveLength(1);
    expect(emitted[0].signature).toBe(sig);
    expect(handle.stats().candidatesEmitted).toBe(1);
    handle.stop();
  });

  it('drops a signature whose transaction contains only filtered-out instructions (loader Write)', async () => {
    const watchedAddress = Keypair.generate().publicKey.toBase58();
    const sig = 'sig-write-only';
    const conn = makeFakeConnection({
      signaturesByAddress: { [watchedAddress]: [{ signature: sig, slot: 501, err: null }] },
      transactionsBySignature: { [sig]: fakeTx(BPF_LOADER_UPGRADEABLE_PROGRAM_ID, 1, 501) },
    });

    const emitted: IngestCandidate[] = [];
    const handle = startPoller({
      connection: conn as any,
      watchedProgramIds: [],
      watchedAccounts: [watchedAddress],
      filter: { trackedProgramIds: new Set(), watchedSigners: new Set() },
      onCandidate: (c) => emitted.push(c),
      reconcileIntervalMs: 10_000_000,
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(emitted).toHaveLength(0);
    expect(handle.stats().candidatesFiltered).toBe(1);
    handle.stop();
  });

  it('dedups the same signature seen via both onLogs and reconciliation', async () => {
    const watchedAddress = Keypair.generate().publicKey.toBase58();
    const sig = 'sig-dup-1';
    const conn = makeFakeConnection({
      signaturesByAddress: { [watchedAddress]: [{ signature: sig, slot: 502, err: null }] },
      transactionsBySignature: { [sig]: fakeTx(BPF_LOADER_UPGRADEABLE_PROGRAM_ID, 3, 502) },
    });

    const emitted: IngestCandidate[] = [];
    const handle = startPoller({
      connection: conn as any,
      watchedProgramIds: [BPF_LOADER_UPGRADEABLE_PROGRAM_ID],
      watchedAccounts: [watchedAddress],
      filter: { trackedProgramIds: new Set(), watchedSigners: new Set() },
      onCandidate: (c) => emitted.push(c),
      reconcileIntervalMs: 10_000_000,
    });

    conn.emitLogs(sig); // "ws" leg sees it too
    await new Promise((r) => setTimeout(r, 20));

    expect(emitted).toHaveLength(1); // deduped, not 2
    handle.stop();
  });
});
