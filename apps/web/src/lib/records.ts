// File: apps/web/src/lib/records.ts
// Reads the Control Record v2 tables (written by apps/worker/src/records/build.ts --db) for the site
// and /api/v1. Every function returns plain JSON-safe data; null when the thing does not exist.

import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { getDb, schema } from './db';

const { record_day, control_record, signer_entry, control_event, claim_check } = schema;

/** The day used when none is asked for: the most recent built day. */
export async function latestDay(): Promise<string | null> {
  const [r] = await getDb().select({ day: record_day.day }).from(record_day).orderBy(desc(record_day.day)).limit(1);
  return r?.day ?? null;
}

export async function dayHeader(day: string) {
  const [r] = await getDb().select().from(record_day).where(eq(record_day.day, day));
  return r ?? null;
}

/** One row per program for a day: enough for lists, maps and filters (the full record is per program). */
export async function registry(day: string) {
  const rows = await getDb()
    .select({ programId: control_record.program_id, stage: control_record.stage, usdFloor: control_record.usd_floor, record: control_record.record })
    .from(control_record).where(eq(control_record.day, day));
  return rows.map(({ programId, stage, usdFloor, record }) => {
    const r = record as ProgramRecordJson;
    return { programId, stage, usdFloor, repo: r.repo, binding: r.stage.bindingPath, reason: r.stage.paths.find((p) => p.path === r.stage.bindingPath)?.reason ?? r.stage.cap?.reason ?? null, modifiers: r.stage.modifiers, upgradeKind: r.upgrade.kind, threshold: r.upgrade.multisig?.threshold ?? null, members: r.upgrade.multisig?.members ?? null, timelockS: r.upgrade.multisig?.timelockS ?? null };
  });
}

export async function programRecord(programId: string, day: string) {
  const [r] = await getDb().select({ record: control_record.record }).from(control_record).where(and(eq(control_record.day, day), eq(control_record.program_id, programId)));
  return (r?.record as ProgramRecordJson | undefined) ?? null;
}

/** Stage for every recorded day of one program, oldest first. */
export async function stageHistory(programId: string) {
  return getDb().select({ day: control_record.day, stage: control_record.stage }).from(control_record).where(eq(control_record.program_id, programId)).orderBy(control_record.day);
}

export async function signer(key: string, day: string) {
  const [r] = await getDb().select({ entry: signer_entry.entry }).from(signer_entry).where(and(eq(signer_entry.day, day), eq(signer_entry.key, key)));
  return r?.entry ?? null;
}

export async function topSigners(day: string, limit = 50) {
  return getDb().select({ key: signer_entry.key, usdBehind: signer_entry.usd_behind, worstStage: signer_entry.worst_stage }).from(signer_entry).where(eq(signer_entry.day, day)).orderBy(desc(signer_entry.usd_behind)).limit(limit);
}

export async function changes(opts: { since?: string; until?: string; programId?: string; kind?: string; limit?: number }) {
  const where = [opts.since ? gte(control_event.day, opts.since) : undefined, opts.until ? lte(control_event.day, opts.until) : undefined, opts.programId ? eq(control_event.program_id, opts.programId) : undefined, opts.kind ? eq(control_event.kind, opts.kind) : undefined].filter(Boolean);
  return getDb().select().from(control_event).where(where.length ? and(...(where as never[])) : sql`true`).orderBy(desc(control_event.day), desc(control_event.id)).limit(Math.min(opts.limit ?? 200, 1000));
}

export async function claimChecks(day: string) {
  return getDb().select().from(claim_check).where(eq(claim_check.day, day));
}

// Shape of control_record.record (apps/worker/src/records/build.ts ProgramRecord), kept as a type here so the web does not import worker code.
export interface ProgramRecordJson {
  programId: string; repo: string | null; usdFloor: number | null;
  upgrade: { authority: string | null; kind: string; multisig: { address: string; threshold: number; members: number; memberKeys: string[]; timelockS: number | null; version: string } | null; timelockCarried: boolean };
  admin: { status: 'read' | 'unknown'; undecoded: { account: string; instances: number; failed: number }[]; programWide: { account: string; field: string; key: string; resolvedAs: string; multisig: { address: string; threshold: number; members: number; timelockS: number | null; version: string } | null }[]; perInstance: { account: string; instances: number; singleKeyOwners: number }[] };
  stage: { programId: string; rulesVersion: string; stage: 0 | 1 | 2 | 3; bindingPath: string; paths: { path: string; stage: number; reason: string }[]; modifiers: string[]; cap: { stage: number; reason: string } | null };
  contagion?: { programId: string; sharedSigners: number; via: [string, string] }[];
}

/** Open proposals on multisigs that control covered programs (records/pending-run.ts). */
export async function pendingActions(opts: { relevantOnly?: boolean; programId?: string; limit?: number }) {
  const { pending_action } = schema;
  const rows = await getDb().select().from(pending_action)
    .where(and(sql`${pending_action.resolved_at} is null`, opts.relevantOnly ? eq(pending_action.control_relevant, true) : undefined, opts.programId ? sql`${pending_action.controls} @> ${JSON.stringify([{ programId: opts.programId }])}::jsonb` : undefined))
    .orderBy(desc(pending_action.status_at)).limit(Math.min(opts.limit ?? 100, 500));
  return rows;
}

/** Programs whose controlling multisig has an open, control-relevant proposal (records/pending-run.ts). */
export async function pendingProgramIds(): Promise<string[]> {
  const rows = await getDb().execute(sql`select distinct c->>'programId' as id from pending_action p, jsonb_array_elements(p.controls) c where p.control_relevant and p.resolved_at is null`);
  return (rows as unknown as { id: string }[]).map((r) => r.id).filter(Boolean);
}

/** Per-program control facts for the Stage map's pick panel and shared-key links (loaded on first pick). */
export interface ControlFacts {
  auth: string | null; kind: string;
  ms: { address: string; threshold: number; members: number; memberKeys: string[]; timelockS: number | null; version: string } | null;
  reason: string | null;
}
export async function controlIndex(day: string): Promise<Record<string, ControlFacts>> {
  const rows = await getDb().select({ programId: control_record.program_id, record: control_record.record }).from(control_record).where(eq(control_record.day, day));
  const out: Record<string, ControlFacts> = {};
  for (const { programId, record } of rows) {
    const r = record as ProgramRecordJson;
    out[programId] = { auth: r.upgrade.authority, kind: r.upgrade.kind, ms: r.upgrade.multisig, reason: r.stage.paths.find((x) => x.path === r.stage.bindingPath)?.reason ?? r.stage.cap?.reason ?? null };
  }
  return out;
}
