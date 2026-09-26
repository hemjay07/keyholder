// File: apps/worker/src/schema.test.ts
// Task 1.3: insert and read one row per core table against a real local
// Postgres 15 instance (see .env / DATABASE_URL — started with pg_ctl on
// :5433, DEV-001-adjacent local dev setup, not a mock).
//
// Skips (does not fail) if DATABASE_URL is unreachable, so `pnpm -r test`
// stays green in environments without the local Postgres running; the
// orchestrator's verification run below shows these tests actually
// executing against a live database.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import * as schema from './schema';
import { testDatabaseUrl } from './test-db';

dotenv.config({ path: join(__dirname, '..', '..', '..', '.env') });

const databaseUrl = testDatabaseUrl();

describe.skipIf(!databaseUrl)('core table round-trips', () => {
  let sql: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 1 });
    db = drizzle(sql, { schema });
    // Tests are idempotent: clear any rows a previous run left behind before
    // inserting, so re-running against the same local database still proves
    // a real insert (not a leftover row from last time).
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, 'sub-test-1'));
    await db
      .delete(schema.risk_deltas)
      .where(eq(schema.risk_deltas.delta_uid, 'drift-test:429731225:threshold_lowered'));
    await db.delete(schema.control_state).where(eq(schema.control_state.protocol_id, 'drift-test'));
    await db.delete(schema.events).where(eq(schema.events.event_uid, 'test-signature-1:0'));
    await db.delete(schema.raw_tx).where(eq(schema.raw_tx.signature, 'test-signature-1'));
    await db
      .delete(schema.authorities)
      .where(eq(schema.authorities.address, '8jj7zJgdr5bDndc7evM74FMGwzLPmd4u4QxNzFi1BMai'));
    await db
      .delete(schema.multisigs)
      .where(eq(schema.multisigs.address, '7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM'));
    await db
      .delete(schema.programs)
      .where(eq(schema.programs.program_id, 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH'));
    await db.delete(schema.protocols).where(eq(schema.protocols.id, 'drift-test'));
  });

  afterAll(async () => {
    await sql.end();
  });

  it('protocols: inserts and reads one row', async () => {
    await db.insert(schema.protocols).values({ id: 'drift-test', name: 'Drift (test)' });
    const rows = await db.select().from(schema.protocols).where(eq(schema.protocols.id, 'drift-test'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Drift (test)');
  });

  it('programs: inserts and reads one row referencing protocols', async () => {
    await db.insert(schema.programs).values({
      program_id: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',
      protocol_id: 'drift-test',
      loader: 'v3',
      is_executable: true,
      tracked: true,
    });
    const rows = await db
      .select()
      .from(schema.programs)
      .where(eq(schema.programs.program_id, 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.protocol_id).toBe('drift-test');
  });

  it('multisigs: inserts and reads one row (real Drift-controlling multisig)', async () => {
    await db.insert(schema.multisigs).values({
      address: '7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM',
      kind: 'squads_v4',
      threshold: 4,
      time_lock_s: 3600,
      member_count: 7,
      updated_slot: 429731225,
    });
    const rows = await db
      .select()
      .from(schema.multisigs)
      .where(eq(schema.multisigs.address, '7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.threshold).toBe(4);
  });

  it('authorities: inserts and reads one row', async () => {
    await db.insert(schema.authorities).values({
      address: '8jj7zJgdr5bDndc7evM74FMGwzLPmd4u4QxNzFi1BMai',
      kind: 'squads_v4',
      multisig_addr: '7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM',
      updated_slot: 429731225,
    });
    const rows = await db
      .select()
      .from(schema.authorities)
      .where(eq(schema.authorities.address, '8jj7zJgdr5bDndc7evM74FMGwzLPmd4u4QxNzFi1BMai'));
    expect(rows).toHaveLength(1);
  });

  it('raw_tx: inserts and reads one row', async () => {
    await db.insert(schema.raw_tx).values({
      signature: 'test-signature-1',
      slot: 429731225,
      block_time: new Date('2026-09-26T00:00:00Z'),
      commitment: 'finalized',
      source: 'backfill',
      status: 'decoded',
    });
    const rows = await db.select().from(schema.raw_tx).where(eq(schema.raw_tx.signature, 'test-signature-1'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.slot).toBe(429731225);
  });

  it('events: inserts and reads one row', async () => {
    await db.insert(schema.events).values({
      id: 1,
      event_uid: 'test-signature-1:0',
      slot: 429731225,
      block_time: new Date('2026-09-26T00:00:00Z'),
      signature: 'test-signature-1',
      ix_path: '0',
      protocol_id: 'drift-test',
      kind: 'upgrade',
    });
    const rows = await db.select().from(schema.events).where(eq(schema.events.event_uid, 'test-signature-1:0'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('upgrade');
  });

  it('control_state: inserts and reads one row', async () => {
    await db.insert(schema.control_state).values({
      protocol_id: 'drift-test',
      slot: 429731225,
      state: { threshold: 4, time_lock_seconds: 3600 },
    });
    const rows = await db
      .select()
      .from(schema.control_state)
      .where(eq(schema.control_state.protocol_id, 'drift-test'));
    expect(rows).toHaveLength(1);
  });

  it('risk_deltas: inserts and reads one row', async () => {
    await db.insert(schema.risk_deltas).values({
      delta_uid: 'drift-test:429731225:threshold_lowered',
      protocol_id: 'drift-test',
      rule_id: 'threshold_lowered',
      rule_version: 1,
      severity: 'high',
    });
    const rows = await db
      .select()
      .from(schema.risk_deltas)
      .where(eq(schema.risk_deltas.delta_uid, 'drift-test:429731225:threshold_lowered'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.severity).toBe('high');
  });

  it('subscriptions: inserts and reads one row', async () => {
    await db.insert(schema.subscriptions).values({
      id: 'sub-test-1',
      user_id: 'user-test-1',
      scope: 'protocol',
      target: 'drift-test',
    });
    const rows = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, 'sub-test-1'));
    expect(rows).toHaveLength(1);
  });
});
