// File: apps/worker/src/pipeline/verification.test.ts
// DB-touching tests against the real `_test` Postgres. `fetchVerificationStatus`
// is mocked (it's a real HTTP call to verify.osec.io, already covered by
// verify-osec.test.ts); `resolveAuthority` (inside refreshProtocolState) is
// also mocked so this test never touches the network.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import * as schema from '../schema';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

vi.mock('../state-builder/verify-osec', () => ({ fetchVerificationStatus: vi.fn() }));
vi.mock('../state-builder/authority', () => ({ resolveAuthority: vi.fn() }));

import { fetchVerificationStatus } from '../state-builder/verify-osec';
import { resolveAuthority } from '../state-builder/authority';
import { runVerificationPoll } from './verification';
import { testDatabaseUrl } from '../test-db';

const databaseUrl = testDatabaseUrl();
const mockFetch = fetchVerificationStatus as unknown as ReturnType<typeof vi.fn>;
const mockResolve = resolveAuthority as unknown as ReturnType<typeof vi.fn>;

describe.skipIf(!databaseUrl)('runVerificationPoll (real local Postgres, _test db)', () => {
  let sql: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;
  const protocolId = 'verify-poll-test-proto';
  const programId = 'VerifyPollTestProgram1111111111111111111';

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 1 });
    db = drizzle(sql, { schema });
    await db.insert(schema.protocols).values({ id: protocolId, name: 'Verify Poll Test' }).onConflictDoNothing();
    await db.insert(schema.programs).values({ program_id: programId, protocol_id: protocolId, tracked: true }).onConflictDoNothing();
    mockResolve.mockResolvedValue({ programDataAddr: 'pd', upgradeAuthority: null, authorityKind: 'immutable', multisig: null });
  });

  afterAll(async () => {
    await db.delete(schema.events).where(eq(schema.events.program_id, programId));
    await db.delete(schema.verification_checks).where(eq(schema.verification_checks.program_id, programId));
    await db.delete(schema.control_state).where(eq(schema.control_state.protocol_id, protocolId));
    await db.delete(schema.programs).where(eq(schema.programs.program_id, programId));
    await db.delete(schema.protocols).where(eq(schema.protocols.id, protocolId));
    await sql.end();
  });

  it('happy: first check for a program records verification_checks but fires no status-change event (no prior check to compare)', async () => {
    mockFetch.mockResolvedValueOnce({
      programId,
      checkedAt: new Date(),
      verifiedStatus: 'verified',
      isVerified: true,
      onChainHash: 'h1',
      executableHash: 'h1',
      commit: 'c1',
      repoUrl: 'https://example.com/repo',
      raw: {},
      error: null,
    });

    const result = await runVerificationPoll(db, {} as any, 1, undefined, { programIds: [programId] });
    expect(result.programsChecked).toBe(1);
    expect(result.statusChanges).toBe(0);

    const checks = await db.select().from(schema.verification_checks).where(eq(schema.verification_checks.program_id, programId));
    expect(checks).toHaveLength(1);
  });

  it('happy: verified -> drifted transition emits a verify_status_changed event and re-runs the state stage', async () => {
    mockFetch.mockResolvedValueOnce({
      programId,
      checkedAt: new Date(Date.now() + 1000),
      verifiedStatus: 'drifted',
      isVerified: false,
      onChainHash: 'h2',
      executableHash: 'h2',
      commit: 'c1',
      repoUrl: 'https://example.com/repo',
      raw: {},
      error: null,
    });

    const result = await runVerificationPoll(db, {} as any, 2, undefined, { programIds: [programId] });
    expect(result.statusChanges).toBe(1);

    const evs = await db.select().from(schema.events).where(eq(schema.events.program_id, programId));
    expect(evs.some((e) => e.kind === 'verify_status_changed')).toBe(true);

    const states = await db.select().from(schema.control_state).where(eq(schema.control_state.protocol_id, protocolId));
    expect(states.length).toBeGreaterThanOrEqual(1);
  });

  it('edge: an unchanged status between two checks does not fire an event', async () => {
    mockFetch.mockResolvedValueOnce({
      programId,
      checkedAt: new Date(Date.now() + 2000),
      verifiedStatus: 'drifted',
      isVerified: false,
      onChainHash: 'h2',
      executableHash: 'h2',
      commit: 'c1',
      repoUrl: 'https://example.com/repo',
      raw: {},
      error: null,
    });

    const before = await db.select().from(schema.events).where(eq(schema.events.program_id, programId));
    const result = await runVerificationPoll(db, {} as any, 3, undefined, { programIds: [programId] });
    expect(result.statusChanges).toBe(0);
    const after = await db.select().from(schema.events).where(eq(schema.events.program_id, programId));
    expect(after).toHaveLength(before.length);
  });

  it('error: fetchVerificationStatus throwing for one program is counted, not thrown out of the poll', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));
    const result = await runVerificationPoll(db, {} as any, 4, undefined, { programIds: [programId] });
    expect(result.errors).toBe(1);
  });
});
