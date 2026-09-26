// File: apps/worker/src/pipeline/protocol-index.test.ts
// DB-touching test against the real `_test` Postgres — see decode.test.ts's
// header for the pattern.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import * as schema from '../schema';
import { buildProtocolIndex } from './protocol-index';
import { EMPTY_CONTROL_STATE } from '@keyholder/risk';
import { testDatabaseUrl } from '../test-db';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

const databaseUrl = testDatabaseUrl();

describe.skipIf(!databaseUrl)('buildProtocolIndex (real local Postgres, _test db)', () => {
  let sql: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;
  const protocolId = 'protocol-index-test-proto';
  const programId = 'ProtocolIndexTestProgram11111111111111111';
  const programDataAddr = 'ProtocolIndexTestProgramData111111111111';
  const authorityAddr = 'ProtocolIndexTestAuthority1111111111111111';

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 1 });
    db = drizzle(sql, { schema });
    await db.delete(schema.control_state).where(eq(schema.control_state.protocol_id, protocolId));
    await db.delete(schema.programs).where(eq(schema.programs.program_id, programId));
    await db.insert(schema.protocols).values({ id: protocolId, name: 'Protocol Index Test' }).onConflictDoNothing();
    await db.insert(schema.programs).values({
      program_id: programId,
      protocol_id: protocolId,
      programdata_addr: programDataAddr,
      tracked: true,
    });
    await db.insert(schema.control_state).values({
      protocol_id: protocolId,
      slot: 1,
      state: { ...EMPTY_CONTROL_STATE, authorityAddress: authorityAddr, asOfSlot: 1 },
    });
  });

  afterAll(async () => {
    await db.delete(schema.control_state).where(eq(schema.control_state.protocol_id, protocolId));
    await db.delete(schema.programs).where(eq(schema.programs.program_id, programId));
    await db.delete(schema.protocols).where(eq(schema.protocols.id, protocolId));
    await sql.end();
  });

  it('happy: resolves programData -> {programId, protocolId}', async () => {
    const index = await buildProtocolIndex(db);
    expect(index.programDataToProgram.get(programDataAddr)).toEqual({ programId, protocolId });
  });

  it('happy: resolves a controller address (authorityAddress) from the latest control_state row', async () => {
    const index = await buildProtocolIndex(db);
    expect(index.controllerToProtocol.get(authorityAddr)).toBe(protocolId);
  });

  it('edge: an unknown programData address is simply absent from the map', async () => {
    const index = await buildProtocolIndex(db);
    expect(index.programDataToProgram.has('not-a-real-address')).toBe(false);
  });
});
