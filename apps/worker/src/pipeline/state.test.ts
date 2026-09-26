// File: apps/worker/src/pipeline/state.test.ts
// DB-touching tests against the real `_test` Postgres (see decode.test.ts's
// header for the pattern). `resolveAuthority` is mocked (it does a live RPC
// read) so these tests exercise the merge/hash-diff logic deterministically;
// the live authority-resolution path itself is already covered by
// state-builder/authority.test.ts and exercised for real in this task's
// live mainnet run.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import * as schema from '../schema';
import { EMPTY_CONTROL_STATE } from '@keyholder/risk';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

vi.mock('../state-builder/authority', () => ({ resolveAuthority: vi.fn() }));

import { resolveAuthority } from '../state-builder/authority';
import { refreshProtocolState } from './state';
import { testDatabaseUrl } from '../test-db';

const databaseUrl = testDatabaseUrl();
const mockResolveAuthority = resolveAuthority as unknown as ReturnType<typeof vi.fn>;
const silentLogger = { info: () => {}, warn: () => {} };

describe.skipIf(!databaseUrl)('refreshProtocolState (real local Postgres, _test db)', () => {
  let sql: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;
  const protocolId = 'state-stage-test-proto';
  const programId = 'StateStageTestProgram1111111111111111111';
  const authority1 = 'StateStageTestAuthority1111111111111111111';
  const authority2 = 'StateStageTestAuthority2222222222222222222';

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 1 });
    db = drizzle(sql, { schema });
    await db.insert(schema.protocols).values({ id: protocolId, name: 'State Stage Test' }).onConflictDoNothing();
    await db.insert(schema.programs).values({ program_id: programId, protocol_id: protocolId, tracked: true }).onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(schema.control_state).where(eq(schema.control_state.protocol_id, protocolId));
    await db.delete(schema.programs).where(eq(schema.programs.program_id, programId));
    await db.delete(schema.protocols).where(eq(schema.protocols.id, protocolId));
    await sql.end();
  });

  it('happy: writes a first control_state row when none exists yet', async () => {
    mockResolveAuthority.mockResolvedValueOnce({
      programDataAddr: 'pd',
      upgradeAuthority: authority1,
      authorityKind: 'single_key',
      multisig: null,
    });

    const result = await refreshProtocolState(db, {} as any, protocolId, 100, silentLogger);
    expect(result.wrote).toBe(true);
    expect(result.after.authorityAddress).toBe(authority1);
    expect(result.before).toBeNull();

    const rows = await db.select().from(schema.control_state).where(eq(schema.control_state.protocol_id, protocolId));
    expect(rows).toHaveLength(1);
  });

  it('edge: does not write a new row when the resolved state is unchanged', async () => {
    mockResolveAuthority.mockResolvedValueOnce({
      programDataAddr: 'pd',
      upgradeAuthority: authority1,
      authorityKind: 'single_key',
      multisig: null,
    });

    const result = await refreshProtocolState(db, {} as any, protocolId, 200, silentLogger);
    expect(result.wrote).toBe(false);

    const rows = await db.select().from(schema.control_state).where(eq(schema.control_state.protocol_id, protocolId));
    expect(rows).toHaveLength(1); // still just the one from the previous test
  });

  it('happy: writes a new row when the authority actually changed', async () => {
    mockResolveAuthority.mockResolvedValueOnce({
      programDataAddr: 'pd',
      upgradeAuthority: authority2,
      authorityKind: 'single_key',
      multisig: null,
    });

    const result = await refreshProtocolState(db, {} as any, protocolId, 300, silentLogger);
    expect(result.wrote).toBe(true);
    expect(result.before?.authorityAddress).toBe(authority1);
    expect(result.after.authorityAddress).toBe(authority2);

    const rows = await db.select().from(schema.control_state).where(eq(schema.control_state.protocol_id, protocolId));
    expect(rows).toHaveLength(2);
  });

  // Replaced 2026-09-26 (orchestrator): the previous test asserted a fallback
  // to folded events on an RPC failure. Live on mainnet that fallback turned a
  // Helius 429 into "Raydium CLMM authority changed to immutable" and back —
  // four false risk deltas. A state that could not be read is never written.
  it('error: writes nothing when live authority resolution throws (e.g. RPC 429)', async () => {
    mockResolveAuthority.mockRejectedValueOnce(new Error('429 Too Many Requests'));

    const result = await refreshProtocolState(db, {} as any, protocolId, 400, silentLogger);
    expect(result.wrote).toBe(false);
    expect(result.skipped).toBe(true);

    const rows = await db.select().from(schema.control_state).where(eq(schema.control_state.protocol_id, protocolId));
    expect(rows).toHaveLength(2);
  });

  it('edge: same upgrade authority but multisig not re-resolved keeps the known multisig (no false change)', async () => {
    const ms = { address: 'StateStageTestMultisig111111111111111111111', kind: 'squads_v4', threshold: 3, memberCount: 4, timeLockS: 0 };
    mockResolveAuthority.mockResolvedValueOnce({ programDataAddr: 'pd', upgradeAuthority: authority2, authorityKind: 'squads_vault', multisig: ms });
    const first = await refreshProtocolState(db, {} as any, protocolId, 500, silentLogger);
    expect(first.wrote).toBe(true);

    // Live read succeeds but cannot map the vault to its multisig this time.
    mockResolveAuthority.mockResolvedValueOnce({ programDataAddr: 'pd', upgradeAuthority: authority2, authorityKind: 'single_key_or_vault_unresolved', multisig: null });
    const second = await refreshProtocolState(db, {} as any, protocolId, 600, silentLogger);
    expect(second.wrote).toBe(false);
    expect(second.after.multisig).toEqual(ms);
    expect(second.after.authorityKind).toBe('squads_vault');
  });

  it('happy: an authority confirmed gone by a successful read (immutable) is a real change', async () => {
    mockResolveAuthority.mockResolvedValueOnce({ programDataAddr: 'pd', upgradeAuthority: null, authorityKind: 'immutable', multisig: null });
    const result = await refreshProtocolState(db, {} as any, protocolId, 700, silentLogger);
    expect(result.wrote).toBe(true);
    expect(result.after.authorityKind).toBe('immutable');
  });
  it('edge: the same multisig in a different shape (extra programVersion) is not a change', async () => {
    const base = { address: 'StateStageTestMultisig222222222222222222222', kind: 'squads_v4', threshold: 2, memberCount: 3, timeLockS: 0, configAuthority: '11111111111111111111111111111111' };
    mockResolveAuthority.mockResolvedValueOnce({ programDataAddr: 'pd', upgradeAuthority: authority1, authorityKind: 'squads_vault', multisig: { ...base, programVersion: 'v4' } });
    const first = await refreshProtocolState(db, {} as any, protocolId, 800, silentLogger);
    expect(first.wrote).toBe(true);

    mockResolveAuthority.mockResolvedValueOnce({ programDataAddr: 'pd', upgradeAuthority: authority1, authorityKind: 'squads_vault', multisig: base });
    const second = await refreshProtocolState(db, {} as any, protocolId, 900, silentLogger);
    expect(second.wrote).toBe(false);
  });
});
