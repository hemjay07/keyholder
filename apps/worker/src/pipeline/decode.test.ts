// File: apps/worker/src/pipeline/decode.test.ts
// DB-touching tests against the real `_test` Postgres (vitest.setup.ts
// repoints DATABASE_URL there globally) — same pattern as
// replay/store.test.ts and schema.test.ts. `idlCache`/`connection` are
// stubbed since these tests exercise the loader/system paths (pure bytes,
// no IDL needed) and the "no IDL discoverable" path; live Anchor decoding
// against a real network IDL is covered by this task's live mainnet run
// (see the task report), not by this offline unit suite.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import bs58 from 'bs58';
import * as schema from '../schema';
import { runDecodeStage } from './decode';
import type { IdlCache } from './idl-cache';
import type { ProtocolIndex } from './protocol-index';
import { testDatabaseUrl } from '../test-db';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

const databaseUrl = testDatabaseUrl();

const noIdlCache: IdlCache = { get: async () => null };
const emptyProtocolIndex: ProtocolIndex = {
  programDataToProgram: new Map(),
  programIdToProtocol: new Map(),
  controllerToProtocol: new Map(),
};

function fakeConnection() {
  return {} as any;
}

/** Builds a minimal legacy-message raw_tx JSON blob for a single instruction. */
function buildRawTx(params: { programId: string; data: Buffer; accounts: string[]; numRequiredSignatures?: number; slot?: number }): Buffer {
  const accountKeys = params.accounts;
  const stored = {
    transaction: {
      message: {
        header: { numRequiredSignatures: params.numRequiredSignatures ?? 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 1 },
        accountKeys: [...accountKeys, params.programId],
        recentBlockhash: '11111111111111111111111111111111111111111111',
        instructions: [
          {
            programIdIndex: accountKeys.length,
            accounts: accountKeys.map((_, i) => i),
            data: bs58.encode(params.data),
          },
        ],
      },
    },
    meta: { innerInstructions: [], loadedAddresses: { writable: [], readonly: [] } },
    version: 'legacy',
    slot: params.slot ?? 123456,
    blockTime: 1_700_000_000,
  };
  return Buffer.from(JSON.stringify(stored), 'utf8');
}

const LOADER_ID = 'BPFLoaderUpgradeab1e11111111111111111111111';

describe.skipIf(!databaseUrl)('runDecodeStage (real local Postgres, _test db)', () => {
  let sql: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;
  const testSignatures: string[] = [];

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 1 });
    db = drizzle(sql, { schema });
  });

  afterAll(async () => {
    if (testSignatures.length > 0) {
      for (const sig of testSignatures) {
        await db.delete(schema.events).where(eq(schema.events.signature, sig));
        await db.delete(schema.raw_tx).where(eq(schema.raw_tx.signature, sig));
      }
    }
    await sql.end();
  });

  it('happy: decodes a real-shaped BPF Loader Upgrade instruction into an events row and marks raw_tx decoded', async () => {
    const sig = `decode-test-upgrade-${Date.now()}`;
    testSignatures.push(sig);
    const programData = '11111111111111111111111111111111111111112';
    const program = '11111111111111111111111111111111111111113';
    const buffer = '11111111111111111111111111111111111111114';
    const spill = '11111111111111111111111111111111111111115';
    const rent = 'SysvarRent111111111111111111111111111111';
    const clock = 'SysvarC1ock11111111111111111111111111111111';
    const authority = '11111111111111111111111111111111111111116';
    const data = Buffer.alloc(4);
    data.writeUInt32LE(3, 0); // tag 3 = Upgrade

    const tx = buildRawTx({
      programId: LOADER_ID,
      data,
      accounts: [programData, program, buffer, spill, rent, clock, authority],
      numRequiredSignatures: 7,
    });

    await db.insert(schema.raw_tx).values({
      signature: sig,
      slot: 123456,
      block_time: new Date(),
      commitment: 'confirmed',
      source: 'poller',
      tx,
      status: 'pending',
    });

    const result = await runDecodeStage({ db, connection: fakeConnection(), idlCache: noIdlCache, protocolIndex: emptyProtocolIndex });
    expect(result.rawTxProcessed).toBeGreaterThanOrEqual(1);
    expect(result.eventsInserted).toBeGreaterThanOrEqual(1);

    const [row] = await db.select().from(schema.raw_tx).where(eq(schema.raw_tx.signature, sig));
    expect(row?.status).toBe('decoded');

    const evs = await db.select().from(schema.events).where(eq(schema.events.signature, sig));
    expect(evs).toHaveLength(1);
    expect(evs[0]?.kind).toBe('upgrade');
    expect(evs[0]?.event_uid).toBe(`${sig}:0`);
  });

  it('happy: is idempotent — running twice on the same raw_tx does not duplicate events', async () => {
    const sig = `decode-test-idempotent-${Date.now()}`;
    testSignatures.push(sig);
    const data = Buffer.alloc(4);
    data.writeUInt32LE(3, 0);
    const accounts = Array.from({ length: 7 }, (_, i) => `1111111111111111111111111111111111111111${i}`);
    const tx = buildRawTx({ programId: LOADER_ID, data, accounts, numRequiredSignatures: 7 });

    await db.insert(schema.raw_tx).values({ signature: sig, slot: 1, block_time: new Date(), commitment: 'confirmed', source: 'poller', tx, status: 'pending' });
    await runDecodeStage({ db, connection: fakeConnection(), idlCache: noIdlCache, protocolIndex: emptyProtocolIndex });
    // Reset to pending to force a second decode pass over the same row.
    await db.update(schema.raw_tx).set({ status: 'pending' }).where(eq(schema.raw_tx.signature, sig));
    await runDecodeStage({ db, connection: fakeConnection(), idlCache: noIdlCache, protocolIndex: emptyProtocolIndex });

    const evs = await db.select().from(schema.events).where(eq(schema.events.signature, sig));
    expect(evs).toHaveLength(1);
  });

  it('edge: an unrecognized program with no IDL is stored as account_changed_undecoded, not dropped', async () => {
    const sig = `decode-test-undecoded-${Date.now()}`;
    testSignatures.push(sig);
    const unknownProgram = 'Vote111111111111111111111111111111111111';
    const data = Buffer.from([9, 9, 9, 9]);
    const tx = buildRawTx({ programId: unknownProgram, data, accounts: ['11111111111111111111111111111111111111117'] });

    await db.insert(schema.raw_tx).values({ signature: sig, slot: 1, block_time: new Date(), commitment: 'confirmed', source: 'poller', tx, status: 'pending' });
    await runDecodeStage({ db, connection: fakeConnection(), idlCache: noIdlCache, protocolIndex: emptyProtocolIndex });

    const evs = await db.select().from(schema.events).where(eq(schema.events.signature, sig));
    expect(evs).toHaveLength(1);
    expect(evs[0]?.kind).toBe('account_changed_undecoded');
  });

  it('error: a raw_tx row with malformed JSON is marked failed, not left pending forever', async () => {
    const sig = `decode-test-malformed-${Date.now()}`;
    testSignatures.push(sig);
    await db.insert(schema.raw_tx).values({
      signature: sig,
      slot: 1,
      block_time: new Date(),
      commitment: 'confirmed',
      source: 'poller',
      tx: Buffer.from('not json at all', 'utf8'),
      status: 'pending',
    });

    await runDecodeStage({ db, connection: fakeConnection(), idlCache: noIdlCache, protocolIndex: emptyProtocolIndex });

    const [row] = await db.select().from(schema.raw_tx).where(eq(schema.raw_tx.signature, sig));
    expect(row?.status).toBe('failed');
  });
});
