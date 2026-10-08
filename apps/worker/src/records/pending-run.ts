// File: apps/worker/src/records/pending-run.ts
// Scan every Squads v4 multisig that controls a covered program (from the latest built record day), store
// each open proposal in pending_action, mark ones that left the queue as resolved, explain new
// control-relevant ones with Claude, and add them to the feed as pending_control_action.
// Run: npx tsx src/records/pending-run.ts   (box: keyholder-pending.timer, every 30 min)

import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { Connection } from '@solana/web3.js';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import { discoverIdl, type AnchorIdl } from '@keyholder/decoder';
import { pendingFor, controlRelevant, SQUADS_V4, type PendingTx } from './pending';
import { explainPending, EXPLAIN_MODEL } from './explain';
import type { ProgramRecord } from './build';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

/** Cap on new explanations per run (spend control); the rest are explained on later runs. */
const MAX_EXPLAIN_PER_RUN = Number(process.env.PENDING_MAX_EXPLAIN ?? 20);

interface MsInfo { address: string; threshold: number; timelockS: number | null; controls: { programId: string; path: string }[] }

/** v4 multisigs that control a covered program on the latest record day. */
export function controllingV4(records: ProgramRecord[]): MsInfo[] {
  const by = new Map<string, MsInfo>();
  const add = (m: ProgramRecord['upgrade']['multisig'], programId: string, path: string) => {
    if (!m || m.version !== 'v4') return;
    const e = by.get(m.address) ?? { address: m.address, threshold: m.threshold, timelockS: m.timelockS, controls: [] };
    e.controls.push({ programId, path });
    by.set(m.address, e);
  };
  for (const r of records) {
    add(r.upgrade.multisig, r.programId, 'upgrade');
    for (const a of r.admin.programWide) add(a.multisig as ProgramRecord['upgrade']['multisig'], r.programId, `admin:${a.account}.${a.field}`);
  }
  return [...by.values()];
}

async function main(): Promise<void> {
  const postgres = (await import('postgres')).default;
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  // Own RPC setting: proposal scans are getProgramAccounts on the Squads program, which exceed the daily job's
  // free-tier provider limits (Alchemy 429 on the box, 2026-10-08); the public endpoint serves them.
  const conn = new Connection(process.env.PENDING_RPC_URL ?? 'https://api.mainnet-beta.solana.com', 'confirmed');
  const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  try {
    const [{ day } = { day: null }] = await sql`select max(day)::text as day from record_day`;
    if (!day) throw new Error('no record day built');
    const records = (await sql`select record from control_record where day = ${day}`).map((r) => r.record as ProgramRecord);
    const idl = ((await discoverIdl(SQUADS_V4, conn))?.idl ?? JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', 'packages', 'decoder', 'test', 'fixtures', 'squads-v4-idl.json'), 'utf8'))) as AnchorIdl;
    const seen = new Set<string>(); let created = 0, explained = 0, errors = 0;
    for (const ms of controllingV4(records)) {
      let open: PendingTx[] = [];
      try { open = await pendingFor(conn, idl, ms.address); } catch { errors++; continue; }
      for (const t of open) {
        seen.add(t.address);
        const relevant = controlRelevant(t);
        const ins = await sql`insert into pending_action (address, multisig, tx_index, kind, status, status_at, approvals, threshold, timelock_s, actions, controls, control_relevant)
          values (${t.address}, ${t.multisig}, ${t.index}, ${t.kind}, ${t.status}, ${t.statusAt ? new Date(t.statusAt * 1000) : null}, ${t.approvals.length}, ${ms.threshold}, ${ms.timelockS}, ${sql.json(t.actions as never)}, ${sql.json(ms.controls as never)}, ${relevant})
          on conflict (address) do update set status = excluded.status, status_at = excluded.status_at, approvals = excluded.approvals, threshold = excluded.threshold, timelock_s = excluded.timelock_s, last_seen = now(), resolved_at = null
          returning (xmax = 0) as inserted, explanation`;
        if (ins[0]?.inserted) {
          created++;
          if (relevant) for (const c of ms.controls) await sql`insert into control_event (day, program_id, kind, path, from_value, to_value, extra) values (${day}, ${c.programId}, 'pending_control_action', ${c.path}, ${sql.json(null as never)}, ${sql.json(t.status as never)}, ${sql.json({ multisig: t.multisig, transaction: t.address, actions: t.actions } as never)}) on conflict do nothing`;
        }
        if (relevant && !ins[0]?.explanation && client && explained < MAX_EXPLAIN_PER_RUN) {
          try {
            const text = await explainPending(client, t, { threshold: ms.threshold, timelockS: ms.timelockS, controls: ms.controls, now: Math.floor(Date.now() / 1000) });
            if (text) { await sql`update pending_action set explanation = ${text}, explained_by = ${EXPLAIN_MODEL} where address = ${t.address}`; explained++; }
          } catch (e) { errors++; console.error('explain failed', t.address, e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e)); }
        }
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    const resolved = await sql`update pending_action set resolved_at = now() where resolved_at is null and not (address = any(${[...seen]})) returning address`;
    console.log(JSON.stringify({ day, open: seen.size, created, explained, resolved: resolved.length, errors, llm: Boolean(client) }));
  } finally { await sql.end(); }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
