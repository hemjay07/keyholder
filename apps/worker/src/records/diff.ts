// File: apps/worker/src/records/diff.ts
// Control Feed, daily part (design/REVAMP-3.md, Part 1 §6, D6): every change between two days' records.
// Pure: two record lists in, events out, ordered by program then kind. A stage change carries the path
// whose verdict moved, so the cause is always shown next to the effect.

import type { ProgramRecord } from './build';

export type EventKind =
  | 'program_added' | 'program_dropped' | 'program_closed' | 'program_reopened'
  | 'authority_changed' | 'multisig_replaced' | 'threshold_changed' | 'timelock_changed' | 'members_changed'
  | 'admin_changed' | 'stage_changed' | 'claim_broken';

export interface ControlEvent {
  day: string; programId: string; kind: EventKind; path: string;
  from: unknown; to: unknown;
  /** members_changed only */
  added?: string[]; removed?: string[];
}

const ORDER: EventKind[] = ['program_added', 'program_dropped', 'program_closed', 'program_reopened', 'authority_changed', 'multisig_replaced', 'threshold_changed', 'timelock_changed', 'members_changed', 'admin_changed', 'stage_changed', 'claim_broken'];
const closed = (r: ProgramRecord) => r.stage.modifiers.includes('closed');

export function diffRecords(day: string, before: ProgramRecord[], after: ProgramRecord[]): ControlEvent[] {
  const prev = new Map(before.map((r) => [r.programId, r]));
  const next = new Map(after.map((r) => [r.programId, r]));
  const out: ControlEvent[] = [];
  const ev = (programId: string, kind: EventKind, path: string, from: unknown, to: unknown, extra: Partial<ControlEvent> = {}) => out.push({ day, programId, kind, path, from, to, ...extra });

  for (const [id, b] of next) {
    const a = prev.get(id);
    // A program new to coverage is bookkeeping, not a control change: no event.
    if (!a) continue;
    if (!closed(a) && closed(b)) ev(id, 'program_closed', 'program', a.upgrade.authority, null);
    if (closed(a) && !closed(b)) ev(id, 'program_reopened', 'program', null, b.upgrade.authority);

    if (!closed(b) && a.upgrade.authority !== b.upgrade.authority) ev(id, 'authority_changed', 'upgrade', a.upgrade.authority, b.upgrade.authority);
    const ma = a.upgrade.multisig, mb = b.upgrade.multisig;
    if (ma && mb && ma.address !== mb.address) ev(id, 'multisig_replaced', 'upgrade', ma.address, mb.address);
    if (ma && mb && ma.address === mb.address) {
      if (ma.threshold !== mb.threshold) ev(id, 'threshold_changed', 'upgrade', `${ma.threshold} of ${ma.members}`, `${mb.threshold} of ${mb.members}`);
      // a timelock carried back from a later day was never observed on the earlier day: no event from it
      if ((ma.timelockS ?? 0) !== (mb.timelockS ?? 0) && !a.upgrade.timelockCarried && !b.upgrade.timelockCarried) ev(id, 'timelock_changed', 'upgrade', ma.timelockS, mb.timelockS);
      const sa = new Set(ma.memberKeys ?? []), sb = new Set(mb.memberKeys ?? []);
      const added = [...sb].filter((k) => !sa.has(k)).sort(), removed = [...sa].filter((k) => !sb.has(k)).sort();
      if ((added.length || removed.length) && sa.size && sb.size) ev(id, 'members_changed', 'upgrade', ma.members, mb.members, { added, removed });
    }

    const keyOf = (r: ProgramRecord) => new Map(r.admin.programWide.map((x) => [`admin:${x.account}.${x.field}`, x.key]));
    const ka = keyOf(a), kb = keyOf(b);
    for (const p of new Set([...ka.keys(), ...kb.keys()])) if (ka.get(p) !== kb.get(p)) ev(id, 'admin_changed', p, ka.get(p) ?? null, kb.get(p) ?? null);

    if (a.stage.stage !== b.stage.stage) {
      // the cause: the path whose verdict moved, or the binding path of the new stage
      const va = new Map(a.stage.paths.map((v) => [v.path, v.stage]));
      const moved = b.stage.paths.find((v) => va.get(v.path) !== v.stage)?.path ?? b.stage.bindingPath;
      ev(id, 'stage_changed', moved, a.stage.stage, b.stage.stage);
    }
  }

  return out.sort((x, y) => (x.programId < y.programId ? -1 : x.programId > y.programId ? 1 : ORDER.indexOf(x.kind) - ORDER.indexOf(y.kind)));
}
