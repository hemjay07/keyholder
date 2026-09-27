// File: apps/web/src/lib/api-client.ts
// Server-side data loaders backing the REST v1 routes. Deviation from
// arch/D-web.md §8: that section's `db.query.*.findFirst({ where: {...} })`
// object-shorthand does not exist on drizzle-orm 0.45's relational query API
// (which needs `where: (t, {eq}) => eq(...)` and a `relations()` config this
// schema never defines) — every loader below uses the core query builder.

import { desc, eq, and, lte, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from './db';
import { toControlFacts, type StoredControlState, type ControlFacts } from './control';

export interface ProtocolSummary {
  id: string;
  name: string;
  category: string | null;
  tvlUsd: string | null;
  tracked: boolean;
  controlFacts: ControlFacts | null;
  evidenceSignature: string | null;
  evidenceNote: string | null;
}

/** Latest control_state row per protocol_id (max slot), via DISTINCT ON. */
async function latestControlStates(): Promise<Map<string, { slot: number; state: StoredControlState }>> {
  const db = getDb();
  const rows = await db.execute<{ protocol_id: string; slot: string | number; state: unknown }>(sql`
    SELECT DISTINCT ON (protocol_id) protocol_id, slot, state
    FROM control_state
    ORDER BY protocol_id, slot DESC
  `);
  const map = new Map<string, { slot: number; state: StoredControlState }>();
  for (const row of rows as unknown as Array<{ protocol_id: string; slot: string | number; state: unknown }>) {
    map.set(row.protocol_id, { slot: Number(row.slot), state: row.state as StoredControlState });
  }
  return map;
}

async function evidenceForAddresses(addresses: string[]): Promise<Map<string, { signature: string | null; note: string | null }>> {
  if (addresses.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({
      address: schema.authorities.address,
      evidence_signature: schema.authorities.evidence_signature,
      evidence_note: schema.authorities.evidence_note,
    })
    .from(schema.authorities)
    .where(inArray(schema.authorities.address, addresses));
  return new Map(rows.map((r) => [r.address, { signature: r.evidence_signature, note: r.evidence_note }]));
}

export async function fetchProtocols(): Promise<ProtocolSummary[]> {
  const db = getDb();
  const protocols = await db.select().from(schema.protocols);
  const tracked = await db
    .select({ protocol_id: schema.programs.protocol_id, tracked: schema.programs.tracked })
    .from(schema.programs);
  const trackedByProtocol = new Set(tracked.filter((t) => t.tracked).map((t) => t.protocol_id));

  const statesByProtocol = await latestControlStates();
  const authorityAddresses = [...statesByProtocol.values()]
    .map((s) => s.state.authorityAddress)
    .filter((a): a is string => !!a);
  const evidence = await evidenceForAddresses(authorityAddresses);

  return protocols.map((p) => {
    const latest = statesByProtocol.get(p.id);
    const facts = latest ? toControlFacts(latest.state) : null;
    const ev = latest?.state.authorityAddress ? evidence.get(latest.state.authorityAddress) : undefined;
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      tvlUsd: p.tvl_usd,
      tracked: trackedByProtocol.has(p.id),
      controlFacts: facts,
      evidenceSignature: ev?.signature ?? null,
      evidenceNote: ev?.note ?? null,
    };
  });
}

export async function fetchProtocol(id: string): Promise<(ProtocolSummary & { programs: Array<{ programId: string; label: string | null; loader: string | null }>; checkedAt: string | null }) | null> {
  const db = getDb();
  const [protocol] = await db.select().from(schema.protocols).where(eq(schema.protocols.id, id));
  if (!protocol) return null;

  const programs = await db.select().from(schema.programs).where(eq(schema.programs.protocol_id, id));
  const [latest] = await db
    .select()
    .from(schema.control_state)
    .where(eq(schema.control_state.protocol_id, id))
    .orderBy(desc(schema.control_state.slot))
    .limit(1);

  const facts = latest ? toControlFacts(latest.state as StoredControlState) : null;
  const [check] = await db.select().from(schema.control_checks).where(eq(schema.control_checks.protocol_id, id)).limit(1);
  const authorityAddress = latest ? (latest.state as StoredControlState).authorityAddress : null;
  const evidence = authorityAddress ? await evidenceForAddresses([authorityAddress]) : new Map();
  const ev = authorityAddress ? evidence.get(authorityAddress) : undefined;

  return {
    id: protocol.id,
    name: protocol.name,
    category: protocol.category,
    tvlUsd: protocol.tvl_usd,
    tracked: programs.some((p) => p.tracked),
    controlFacts: facts,
    evidenceSignature: ev?.signature ?? null,
    evidenceNote: ev?.note ?? null,
    programs: programs.map((p) => ({ programId: p.program_id, label: p.label, loader: p.loader })),
    checkedAt: check?.checked_at?.toISOString() ?? null,
  };
}

export async function fetchPrograms(options?: { protocol?: string }) {
  const db = getDb();
  const query = db.select().from(schema.programs);
  const rows = options?.protocol
    ? await query.where(eq(schema.programs.protocol_id, options.protocol))
    : await query;
  return rows.map((p) => ({
    programId: p.program_id,
    protocolId: p.protocol_id,
    label: p.label,
    loader: p.loader,
    tracked: p.tracked ?? false,
    firstSeenSlot: p.first_seen_slot,
  }));
}

export interface EventFilters {
  protocol?: string;
  minSeverity?: string;
  cursor?: string; // opaque: created_at ISO string of the last row seen
  limit?: number;
}

const SEVERITY_RANK: Record<string, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

export async function fetchEvents(options: EventFilters = {}) {
  const db = getDb();
  const limit = Math.min(options.limit ?? 50, 200);

  const conditions = [];
  if (options.protocol) conditions.push(eq(schema.risk_deltas.protocol_id, options.protocol));
  if (options.cursor) conditions.push(sql`${schema.risk_deltas.created_at} < ${new Date(options.cursor).toISOString()}`);

  let rows = await db
    .select()
    .from(schema.risk_deltas)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.risk_deltas.created_at))
    .limit(limit + 1);

  if (options.minSeverity) {
    const min = SEVERITY_RANK[options.minSeverity] ?? 0;
    rows = rows.filter((r) => (SEVERITY_RANK[r.severity] ?? 0) >= min);
  }

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  return {
    events: page.map((r) => ({
      uid: r.delta_uid,
      protocolId: r.protocol_id,
      ruleId: r.rule_id,
      ruleVersion: r.rule_version,
      severity: r.severity,
      explanation: r.explanation,
      facts: r.facts,
      status: r.status,
      createdAt: r.created_at?.toISOString() ?? null,
    })),
    cursor: page.length ? page[page.length - 1]?.created_at?.toISOString() ?? null : null,
    hasMore,
  };
}

export async function fetchEventDetail(uid: string) {
  const db = getDb();
  const [delta] = await db.select().from(schema.risk_deltas).where(eq(schema.risk_deltas.delta_uid, uid));
  if (!delta) return null;

  const eventIds = delta.event_ids ?? [];
  const rawEvents = eventIds.length
    ? await db.select().from(schema.events).where(inArray(schema.events.id, eventIds)).orderBy(schema.events.slot)
    : [];

  const firstSlot = rawEvents[0]?.slot;
  const lastSlot = rawEvents[rawEvents.length - 1]?.slot;

  const [before] = firstSlot != null
    ? await db
        .select()
        .from(schema.control_state)
        .where(and(eq(schema.control_state.protocol_id, delta.protocol_id), lte(schema.control_state.slot, firstSlot - 1)))
        .orderBy(desc(schema.control_state.slot))
        .limit(1)
    : [];

  const [after] = lastSlot != null
    ? await db
        .select()
        .from(schema.control_state)
        .where(and(eq(schema.control_state.protocol_id, delta.protocol_id), lte(schema.control_state.slot, lastSlot)))
        .orderBy(desc(schema.control_state.slot))
        .limit(1)
    : [];

  // Correction history: later risk_deltas that reference this one via correction_id.
  const corrections = await db
    .select()
    .from(schema.risk_deltas)
    .where(eq(schema.risk_deltas.correction_id, delta.id));

  return {
    uid: delta.delta_uid,
    protocolId: delta.protocol_id,
    ruleId: delta.rule_id,
    severity: delta.severity,
    explanation: delta.explanation,
    status: delta.status,
    facts: delta.facts,
    createdAt: delta.created_at?.toISOString() ?? null,
    stateBefore: before ? toControlFacts(before.state as StoredControlState) : null,
    stateAfter: after ? toControlFacts(after.state as StoredControlState) : null,
    events: rawEvents.map((e) => ({ id: e.id, slot: e.slot, signature: e.signature, kind: e.kind })),
    corrections: corrections.map((c) => ({
      deltaUid: c.delta_uid,
      status: c.status,
      explanation: c.explanation,
      createdAt: c.created_at?.toISOString() ?? null,
    })),
  };
}

export async function fetchControlStateAtSlot(protocolId: string, slot?: number) {
  const db = getDb();
  const conditions = [eq(schema.control_state.protocol_id, protocolId)];
  if (slot != null) conditions.push(lte(schema.control_state.slot, slot));

  const [row] = await db
    .select()
    .from(schema.control_state)
    .where(and(...conditions))
    .orderBy(desc(schema.control_state.slot))
    .limit(1);

  if (!row) return null;
  return {
    protocolId: row.protocol_id,
    slot: row.slot,
    facts: toControlFacts(row.state as StoredControlState),
    raw: row.state,
  };
}

export async function fetchDriftReplay() {
  const db = getDb();
  // Real incident ids carry a run-time suffix (e.g. "drift-2026-03-01_04-03"),
  // not the bare date arch/D-web.md assumed — match by prefix.
  const [run] = await db
    .select()
    .from(schema.replay_runs)
    .where(sql`${schema.replay_runs.incident} LIKE 'drift-2026-03-01%'`)
    .orderBy(desc(schema.replay_runs.created_at))
    .limit(1);

  if (!run) return null;

  const alerts = await db
    .select()
    .from(schema.replay_alerts)
    .where(eq(schema.replay_alerts.run_id, run.id))
    .orderBy(schema.replay_alerts.slot);

  return {
    runId: run.id,
    incident: run.incident,
    fromSlot: run.from_slot,
    toSlot: run.to_slot,
    firstAlertSlot: run.first_alert_slot,
    leadTimeSeconds: run.lead_time_seconds,
    posture: run.posture,
    frames: alerts.map((a) => ({
      slot: a.slot,
      severity: a.severity,
      ruleId: a.rule_id,
      explanation: a.explanation,
      facts: a.facts,
      createdAt: a.created_at?.toISOString() ?? null,
    })),
  };
}

/** Chain events that change who controls a program (the /feed record). */
export const CONTROL_CHANGE_KINDS = ['upgrade', 'set_authority', 'config_transaction_execute'] as const;

export async function fetchControlChanges(options: { protocol?: string; before?: string; limit?: number } = {}) {
  const db = getDb();
  const limit = Math.min(options.limit ?? 60, 200);
  const conditions = [
    inArray(schema.events.kind, [...CONTROL_CHANGE_KINDS]),
    sql`${schema.events.protocol_id} is not null`,
    sql`coalesce(${schema.events.tombstoned}, false) = false`,
  ];
  if (options.protocol) conditions.push(eq(schema.events.protocol_id, options.protocol));
  if (options.before) conditions.push(sql`${schema.events.block_time} < ${new Date(options.before).toISOString()}`);

  const rows = await db
    .select({
      uid: schema.events.event_uid,
      slot: schema.events.slot,
      blockTime: schema.events.block_time,
      signature: schema.events.signature,
      protocolId: schema.events.protocol_id,
      programId: schema.events.program_id,
      kind: schema.events.kind,
      payload: schema.events.payload,
    })
    .from(schema.events)
    .where(and(...conditions))
    .orderBy(desc(schema.events.block_time))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  return {
    changes: page.map((r) => ({ ...r, blockTime: r.blockTime.toISOString() })),
    before: rows.length > limit ? page[page.length - 1]?.blockTime.toISOString() ?? null : null,
  };
}

export async function countControlChangesSince(since: Date) {
  const db = getDb();
  const rows = await db
    .select({ protocolId: schema.events.protocol_id, n: sql<number>`count(*)::int` })
    .from(schema.events)
    .where(and(inArray(schema.events.kind, [...CONTROL_CHANGE_KINDS]), sql`${schema.events.protocol_id} is not null`, sql`${schema.events.block_time} >= ${since.toISOString()}`))
    .groupBy(schema.events.protocol_id);
  return rows;
}

/** Control changes per UTC day per protocol since `since` (the /feed seismograph). */
export async function dailyControlChanges(since: Date) {
  const db = getDb();
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${schema.events.block_time} at time zone 'UTC'), 'YYYY-MM-DD')`,
      protocolId: schema.events.protocol_id,
      n: sql<number>`count(*)::int`,
    })
    .from(schema.events)
    .where(and(inArray(schema.events.kind, [...CONTROL_CHANGE_KINDS]), sql`${schema.events.protocol_id} is not null`, sql`${schema.events.block_time} >= ${since.toISOString()}`))
    .groupBy(sql`1`, schema.events.protocol_id);
  return rows;
}

/** One decoded chain event (the /events/[uid] page for a feed row). */
export async function fetchChainEvent(uid: string) {
  const db = getDb();
  const [e] = await db.select().from(schema.events).where(eq(schema.events.event_uid, uid)).limit(1);
  if (!e) return null;
  return {
    uid: e.event_uid,
    slot: e.slot,
    blockTime: e.block_time.toISOString(),
    signature: e.signature,
    ixPath: e.ix_path,
    protocolId: e.protocol_id,
    programId: e.program_id,
    kind: e.kind,
    payload: e.payload as Record<string, unknown> | null,
    finalized: e.finalized ?? false,
  };
}
