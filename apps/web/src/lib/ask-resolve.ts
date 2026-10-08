// File: apps/web/src/lib/ask-resolve.ts
// The instant half of Ask (design/ASK-PLAN.md §1): a program name, program id or signer key resolves straight from
// the Control Record, no model call, in one or two queries. Also builds the compact program cards that every Ask
// answer (instant or modelled) renders.
import { latestDay, programRecord, signer, registry, type ProgramRecordJson } from './records';
import { PROGRAM_NAMES, programName } from './program-names';

export interface CardPath { label: string; stage: number | null; threshold: number | null; members: number | null; timelockS: number | null; kind: string; binding: boolean }
export interface ProgramCard { id: string; name: string; stage: number; usd: number | null; binding: string; repo: string | null; paths: CardPath[]; sharedWith: number }
export interface SignerCard { key: string; multisigs: number; aloneOn: number; programs: { id: string; name: string; stage: number; usd: number | null }[]; usd: number }
export interface Resolved { kind: 'program' | 'signer'; day: string; program?: ProgramCard; signer?: SignerCard }

const ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function toCard(r: ProgramRecordJson): ProgramCard {
  const find = (p: string) => r.stage.paths.find((x) => x.path === p);
  const paths: CardPath[] = [{
    label: 'Upgrade', stage: find('upgrade')?.stage ?? null, kind: r.upgrade.kind, binding: r.stage.bindingPath === 'upgrade',
    threshold: r.upgrade.multisig?.threshold ?? null, members: r.upgrade.multisig?.members ?? null, timelockS: r.upgrade.multisig?.timelockS ?? null,
  }];
  for (const a of r.admin.programWide) {
    const key = `admin:${a.account}.${a.field}`;
    paths.push({ label: `Admin · ${a.field}`, stage: find(key)?.stage ?? null, kind: a.resolvedAs, binding: r.stage.bindingPath === key, threshold: a.multisig?.threshold ?? null, members: a.multisig?.members ?? null, timelockS: a.multisig?.timelockS ?? null });
  }
  return { id: r.programId, name: programName(r.programId), stage: r.stage.stage, usd: r.usdFloor, binding: r.stage.bindingPath, repo: r.repo, paths, sharedWith: r.contagion?.length ?? 0 };
}

export async function programCards(ids: string[], day: string): Promise<ProgramCard[]> {
  const recs = await Promise.all([...new Set(ids)].slice(0, 4).map((id) => programRecord(id, day)));
  return recs.filter((r): r is ProgramRecordJson => Boolean(r)).map(toCard);
}

interface SignerEntry { key: string; multisigs: { threshold: number }[]; programs: { programId: string; stage: number; usdFloor: number | null }[] }

/** Returns null when the text is a real question rather than a name or an address. */
export async function resolveInstant(text: string): Promise<Resolved | null> {
  const q = text.trim().replace(/[?.!]+$/, '');
  const day = await latestDay();
  if (!day) return null;
  if (ADDR.test(q)) {
    const rec = await programRecord(q, day);
    if (rec) return { kind: 'program', day, program: toCard(rec) };
    const s = (await signer(q, day)) as SignerEntry | null;
    if (s) {
      const by = new Map<string, { id: string; name: string; stage: number; usd: number | null }>();
      for (const p of s.programs) { const e = by.get(p.programId); if (!e || p.stage < e.stage) by.set(p.programId, { id: p.programId, name: programName(p.programId), stage: p.stage, usd: p.usdFloor }); }
      const programs = [...by.values()].sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0));
      return { kind: 'signer', day, signer: { key: q, multisigs: s.multisigs.length, aloneOn: s.multisigs.filter((m) => m.threshold === 1).length, programs, usd: programs.reduce((t, p) => t + (p.usd ?? 0), 0) } };
    }
    return null;
  }
  // A bare name ("Kamino Lend", "orca"), not a sentence: match the confirmed names only.
  if (q.split(/\s+/).length > 4) return null;
  const want = q.toLowerCase();
  const hit = Object.entries(PROGRAM_NAMES).find(([, n]) => n.toLowerCase() === want) ?? Object.entries(PROGRAM_NAMES).find(([, n]) => n.toLowerCase().includes(want) && want.length >= 4);
  if (!hit) return null;
  const rec = await programRecord(hit[0], day);
  return rec ? { kind: 'program', day, program: toCard(rec) } : null;
}

/** Ids of every covered program (for validating ids the model puts in an answer). */
export async function coveredIds(day: string): Promise<Set<string>> {
  return new Set((await registry(day)).map((r) => r.programId));
}
