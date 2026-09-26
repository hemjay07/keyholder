import { describe, it, expect } from 'vitest';
import bs58 from 'bs58';
import { CommitmentLevel, type SubscribeUpdate } from '@triton-one/yellowstone-grpc';
import {
  buildSubscribeRequest,
  resolveYellowstoneConfig,
  normalizeYellowstoneUpdate,
  YellowstoneDisabledError,
} from './yellowstone';
import { BPF_LOADER_UPGRADEABLE_PROGRAM_ID } from '@keyholder/decoder';

describe('buildSubscribeRequest', () => {
  it('subscribes to the given program ids with vote/failed excluded', () => {
    const req = buildSubscribeRequest([BPF_LOADER_UPGRADEABLE_PROGRAM_ID]);
    const filter = req.transactions.keyholder_ingest;
    expect(filter).toBeDefined();
    expect(filter.vote).toBe(false);
    expect(filter.failed).toBe(false);
    expect(filter.accountInclude).toEqual([BPF_LOADER_UPGRADEABLE_PROGRAM_ID]);
    expect(req.commitment).toBe(CommitmentLevel.CONFIRMED);
  });
});

describe('resolveYellowstoneConfig — disabled until YELLOWSTONE_TOKEN exists', () => {
  it('throws YellowstoneDisabledError when the token/endpoint are unset', () => {
    const prevEndpoint = process.env.YELLOWSTONE_ENDPOINT;
    const prevToken = process.env.YELLOWSTONE_TOKEN;
    delete process.env.YELLOWSTONE_ENDPOINT;
    delete process.env.YELLOWSTONE_TOKEN;
    try {
      expect(() => resolveYellowstoneConfig(['x'])).toThrow(YellowstoneDisabledError);
    } finally {
      if (prevEndpoint) process.env.YELLOWSTONE_ENDPOINT = prevEndpoint;
      if (prevToken) process.env.YELLOWSTONE_TOKEN = prevToken;
    }
  });

  it('never includes the token value in the thrown error message', () => {
    delete process.env.YELLOWSTONE_ENDPOINT;
    delete process.env.YELLOWSTONE_TOKEN;
    try {
      resolveYellowstoneConfig(['x']);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(YellowstoneDisabledError);
      expect((err as Error).message).not.toMatch(/[A-Za-z0-9]{32,}/); // no token-shaped secret substring
    }
  });

  it('resolves when both endpoint and token are set', () => {
    process.env.YELLOWSTONE_ENDPOINT = 'https://example.test:443';
    process.env.YELLOWSTONE_TOKEN = 'test-token-not-real';
    try {
      const config = resolveYellowstoneConfig(['x']);
      expect(config.endpoint).toBe('https://example.test:443');
    } finally {
      delete process.env.YELLOWSTONE_ENDPOINT;
      delete process.env.YELLOWSTONE_TOKEN;
    }
  });
});

/**
 * Recorded update shape: hand-built to match the real
 * @triton-one/yellowstone-grpc 7.0.1 proto types (grpc/geyser.d.ts +
 * grpc/solana-storage.d.ts, read directly for this task), not captured live
 * (no YELLOWSTONE_TOKEN available). This is a shape/decoding test, not a
 * live-fixture test — logged as DEV-030 UNTESTED against a real Yellowstone
 * payload, same honesty bar as system-decoder.ts's DEV-008.
 */
function buildRecordedUpdate(): SubscribeUpdate {
  const programId = bs58.decode(BPF_LOADER_UPGRADEABLE_PROGRAM_ID);
  const signer = bs58.decode('11111111111111111111111111111111111111');
  const sig = new Uint8Array(64).fill(7);

  return {
    filters: ['keyholder_ingest'],
    createdAt: new Date(),
    transaction: {
      slot: '123456789',
      transaction: {
        signature: sig,
        isVote: false,
        index: '0',
        transaction: {
          signatures: [sig],
          message: {
            header: { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 1 },
            accountKeys: [signer, programId],
            recentBlockhash: new Uint8Array(32),
            versioned: false,
            addressTableLookups: [],
            instructions: [
              {
                programIdIndex: 1,
                accounts: new Uint8Array([0]),
                data: (() => {
                  const d = Buffer.alloc(4);
                  d.writeUInt32LE(3, 0); // Upgrade
                  return d;
                })(),
              },
            ],
          },
        },
        meta: {
          err: undefined,
          fee: '5000',
          preBalances: [],
          postBalances: [],
          innerInstructions: [],
          innerInstructionsNone: true,
          logMessages: [],
          logMessagesNone: true,
          preTokenBalances: [],
          postTokenBalances: [],
          rewards: [],
          loadedWritableAddresses: [],
          loadedReadonlyAddresses: [],
          returnData: undefined,
          returnDataNone: true,
        },
      },
    },
  } as unknown as SubscribeUpdate;
}

describe('normalizeYellowstoneUpdate', () => {
  it('extracts signature, slot, and instructions with resolved program ids', () => {
    const update = buildRecordedUpdate();
    const candidate = normalizeYellowstoneUpdate(update);
    expect(candidate).not.toBeNull();
    expect(candidate!.slot).toBe(123456789);
    expect(candidate!.source).toBe('yellowstone');
    expect(candidate!.instructions).toHaveLength(1);
    expect(candidate!.instructions[0].programId).toBe(BPF_LOADER_UPGRADEABLE_PROGRAM_ID);
    expect(candidate!.instructions[0].data.readUInt32LE(0)).toBe(3); // Upgrade tag
  });

  it('returns null for a non-transaction update (e.g. a slot update)', () => {
    const update = { filters: [], createdAt: new Date() } as unknown as SubscribeUpdate;
    expect(normalizeYellowstoneUpdate(update)).toBeNull();
  });
});
