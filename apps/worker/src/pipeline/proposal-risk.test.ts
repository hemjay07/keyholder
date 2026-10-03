// The governance-proposal path end to end on a real mainnet transaction (Synthetify 2023 attack proposal):
// raw_tx -> decode (InsertTransaction) -> proposal event -> event risk stage -> risk_deltas row.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EMPTY_CONTROL_STATE } from '@keyholder/risk';
import * as schema from '../schema';
import { runDecodeStage } from './decode';
import { runEventRiskStage } from './risk';
import { testDatabaseUrl } from '../test-db';

const fixture = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', 'packages', 'decoder', 'test', 'fixtures', 'spl-gov-insert-upgrade-synthetify.json'), 'utf8'));
const SIG = fixture.transaction.signatures[0] as string;
const GOVERNANCE = 'Aijh3RvCTyxcxi3BXaNj9qSQkXXsGnHAmywuQBC2YSv4';
const PROTOCOL = 'test-synthetify';

describe('governance proposal -> control_proposal_pending', () => {
  let sql: postgres.Sql; let db: PostgresJsDatabase<typeof schema>;
  beforeAll(async () => { sql = postgres(testDatabaseUrl(), { max: 2 }); db = drizzle(sql, { schema }); });
  afterAll(async () => {
    await db.delete(schema.risk_deltas).where(eq(schema.risk_deltas.protocol_id, PROTOCOL));
    await db.delete(schema.events).where(eq(schema.events.signature, SIG));
    await db.delete(schema.raw_tx).where(eq(schema.raw_tx.signature, SIG));
    await sql.end();
  });

  it('happy: the real InsertTransaction becomes a program_upgrade proposal event and a critical delta', async () => {
    await db.insert(schema.raw_tx).values({ signature: SIG, slot: fixture.slot, block_time: new Date(fixture.blockTime * 1000), commitment: 'finalized', source: 'poller', tx: Buffer.from(JSON.stringify(fixture)), status: 'pending' }).onConflictDoNothing();
    const res = await runDecodeStage({ db, connection: {} as never, idlCache: { get: async () => null }, protocolIndex: { programDataToProgram: new Map(), programIdToProtocol: new Map(), controllerToProtocol: new Map([[GOVERNANCE, PROTOCOL]]) } });
    expect(res.proposalEvents).toEqual([{ protocolId: PROTOCOL, slot: fixture.slot, facts: { kind: 'governance_proposal', touches: 'program_upgrade', proposal: '5ma5FMHZHWVrfZMQYsooqS584PtCiXPcuZ1QBbvK93aH' } }]);
    const [ev] = await db.select().from(schema.events).where(eq(schema.events.kind, 'proposal_insert'));
    expect((ev!.payload as { holdUpTimeS: number }).holdUpTimeS).toBe(86400);

    const r = await runEventRiskStage(db, PROTOCOL, fixture.slot, { ...EMPTY_CONTROL_STATE, authorityKind: 'spl_gov' }, res.proposalEvents[0]!.facts);
    expect(r.deltasInserted).toBe(1);
    const [d] = await db.select().from(schema.risk_deltas).where(eq(schema.risk_deltas.protocol_id, PROTOCOL));
    expect(d!.rule_id).toBe('control_proposal_pending');
    expect(d!.severity).toBe('critical');
  });

  it('edge: running the event stage again for the same slot inserts nothing (idempotent)', async () => {
    const r = await runEventRiskStage(db, PROTOCOL, fixture.slot, { ...EMPTY_CONTROL_STATE, authorityKind: 'spl_gov' }, { kind: 'governance_proposal', touches: 'program_upgrade', proposal: 'x' });
    expect(r.deltasInserted).toBe(0);
  });

  it('error: a proposal on an untracked governance yields no proposal event', async () => {
    await db.update(schema.raw_tx).set({ status: 'pending' }).where(eq(schema.raw_tx.signature, SIG));
    await db.delete(schema.events).where(eq(schema.events.signature, SIG));
    const res = await runDecodeStage({ db, connection: {} as never, idlCache: { get: async () => null }, protocolIndex: { programDataToProgram: new Map(), programIdToProtocol: new Map(), controllerToProtocol: new Map() } });
    expect(res.proposalEvents).toEqual([]);
  });
});
