// File: apps/worker/src/records/signers.ts
// Signer intelligence (design/REVAMP-3.md, Part 1 §5, D4): from a day's records, every signer key and
// what it can move. Facts only: keys are never named. A multisig "controls" a program through a path
// (the upgrade authority, or a program-wide admin field).

import type { ProgramRecord, MultisigFacts } from './build';

export interface MultisigControl { address: string; threshold: number; members: number; timelockS: number | null; version: string; controls: { programId: string; path: string }[] }
export interface SignerEntry {
  key: string;
  multisigs: { address: string; threshold: number; members: number; timelockS: number | null; version: string }[];
  programs: { programId: string; path: string; stage: number; usdFloor: number | null }[];
  usdBehind: number;
  worstStage: number | null;
}
export interface Overlap { a: string; b: string; shared: string[] }
export interface SignerIndex { signers: SignerEntry[]; multisigs: MultisigControl[]; overlaps: Overlap[]; contagion: Record<string, { programId: string; sharedSigners: number; via: [string, string] }[]> }

export const CONTAGION_MIN_SHARED = 2;

/** Every multisig that controls a program through some path, with its member keys. */
export function controllingMultisigs(records: ProgramRecord[]): { multisigs: MultisigControl[]; members: Map<string, string[]> } {
  const by = new Map<string, MultisigControl>();
  const members = new Map<string, string[]>();
  const add = (m: MultisigFacts | null, programId: string, path: string) => {
    if (!m) return;
    const e = by.get(m.address) ?? { address: m.address, threshold: m.threshold, members: m.members, timelockS: m.timelockS, version: m.version, controls: [] };
    if (!e.controls.some((c) => c.programId === programId && c.path === path)) e.controls.push({ programId, path });
    by.set(m.address, e);
    if (m.memberKeys?.length) members.set(m.address, m.memberKeys);
  };
  for (const r of records) {
    add(r.upgrade.multisig, r.programId, 'upgrade');
    for (const a of r.admin.programWide) add(a.multisig, r.programId, `admin:${a.account}.${a.field}`);
  }
  return { multisigs: [...by.values()].sort((x, y) => (x.address < y.address ? -1 : 1)), members };
}

export function buildSignerIndex(records: ProgramRecord[]): SignerIndex {
  const { multisigs, members } = controllingMultisigs(records);
  const rec = new Map(records.map((r) => [r.programId, r]));
  const signers = new Map<string, SignerEntry>();
  for (const m of multisigs) {
    for (const key of members.get(m.address) ?? []) {
      const e = signers.get(key) ?? { key, multisigs: [], programs: [], usdBehind: 0, worstStage: null };
      e.multisigs.push({ address: m.address, threshold: m.threshold, members: m.members, timelockS: m.timelockS, version: m.version });
      for (const c of m.controls) {
        if (e.programs.some((p) => p.programId === c.programId && p.path === c.path)) continue;
        const r = rec.get(c.programId)!;
        e.programs.push({ programId: c.programId, path: c.path, stage: r.stage.stage, usdFloor: r.usdFloor });
      }
      signers.set(key, e);
    }
  }
  for (const e of signers.values()) {
    const unique = new Map(e.programs.map((p) => [p.programId, p]));
    e.usdBehind = Math.round([...unique.values()].reduce((a, p) => a + (p.usdFloor ?? 0), 0));
    e.worstStage = e.programs.length ? Math.min(...e.programs.map((p) => p.stage)) : null;
  }

  const overlaps: Overlap[] = [];
  for (let i = 0; i < multisigs.length; i++) for (let j = i + 1; j < multisigs.length; j++) {
    const a = new Set(members.get(multisigs[i]!.address) ?? []);
    const shared = (members.get(multisigs[j]!.address) ?? []).filter((k) => a.has(k)).sort();
    if (shared.length >= CONTAGION_MIN_SHARED) overlaps.push({ a: multisigs[i]!.address, b: multisigs[j]!.address, shared });
  }

  const controlsOf = new Map(multisigs.map((m) => [m.address, m.controls.map((c) => c.programId)]));
  const contagion: SignerIndex['contagion'] = {};
  for (const o of overlaps) {
    for (const [from, to] of [[o.a, o.b], [o.b, o.a]] as const) {
      for (const p of controlsOf.get(from) ?? []) for (const q of controlsOf.get(to) ?? []) {
        if (p === q) continue;
        const list = (contagion[p] ??= []);
        const prev = list.find((x) => x.programId === q);
        if (!prev) list.push({ programId: q, sharedSigners: o.shared.length, via: [from, to] });
        else if (o.shared.length > prev.sharedSigners) Object.assign(prev, { sharedSigners: o.shared.length, via: [from, to] });
      }
    }
  }
  for (const k of Object.keys(contagion)) contagion[k]!.sort((x, y) => y.sharedSigners - x.sharedSigners || (x.programId < y.programId ? -1 : 1));

  return { signers: [...signers.values()].sort((x, y) => y.usdBehind - x.usdBehind || (x.key < y.key ? -1 : 1)), multisigs, overlaps, contagion };
}
