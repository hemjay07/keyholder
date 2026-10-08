// File: apps/web/src/app/pending/page.tsx
// Open votes (design/REVAMP-3.md pending control actions): every open proposal on a multisig that controls a covered
// program and would change control or move funds. Approved ones can run now (after any delay), so they come first.
import Link from 'next/link';
import { pendingActions, latestDay, registry } from '@/lib/records';
import { programName, shortAddr } from '@/lib/program-names';
import { formatUsd } from '@/components/stagemap/format';
import s from './pending.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Open votes', description: 'Open multisig votes that would change who controls a Solana program or move its funds.' };

type Vote = Awaited<ReturnType<typeof pendingActions>>[number];
const days = (d: Date | null) => (d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000)) : null);
const age = (d: Date | null) => { const n = days(d); return n == null ? 'date unknown' : n === 0 ? 'today' : `${n} day${n === 1 ? '' : 's'} ago`; };

function summary(actions: unknown): string {
  if (!Array.isArray(actions) || !actions.length) return 'no actions decoded';
  const by = new Map<string, number>();
  for (const a of actions as { type?: string; program?: string }[]) {
    const k = a.type && a.type !== 'call' ? a.type.replace(/_/g, ' ') : a.program && a.program !== 'unknown' ? `call to ${shortAddr(a.program)}` : 'call to an unlisted program';
    by.set(k, (by.get(k) ?? 0) + 1);
  }
  const out = [...by].map(([k, n]) => (n > 1 ? `${n} × ${k}` : k)).join(' · ');
  return out.charAt(0).toUpperCase() + out.slice(1);
}

const firstSentence = (t: string) => { const m = t.match(/^.*?[.!?](\s|$)/); return (m ? m[0] : t).trim(); };
// Votes that change code or control rank above transfers.
const CONTROL = new Set(['program_upgrade', 'set_upgrade_authority', 'close_program', 'change_threshold', 'remove_member', 'add_member', 'set_timelock']);
const isUpgrade = (v: Vote) => Array.isArray(v.actions) && (v.actions as { type?: string }[]).some((a) => CONTROL.has(a.type ?? ''));

function Row({ v, i, usd }: { v: Vote; i: number; usd: Map<string, { stage: number; usd: number }> }) {
  const controls = (Array.isArray(v.controls) ? v.controls : []) as { programId: string; path: string }[];
  const ids = [...new Set(controls.map((c) => c.programId))];
  const pct = v.threshold ? Math.min(1, v.approvals / v.threshold) : 0;
  return (
    <li className={s.vote} style={{ ['--i' as string]: i, ['--pct' as string]: pct }}>
      <div className={s.head}>
        <div className={s.progs}>{ids.map((id) => { const r = usd.get(id); return <Link key={id} href={`/programs/${id}`}>{programName(id)}<span>{r ? ` Stage ${r.stage}${r.usd ? ` · ${formatUsd(r.usd)}` : ''}` : ''}</span></Link>; })}</div>
        <span className={s.age}>{v.status.toLowerCase()} {age(v.status_at)}</span>
      </div>
      <div className={s.meter}><div className={s.bar} aria-hidden="true"><i /></div><span>{v.approvals} of {v.threshold ?? '?'} approvals{v.timelock_s ? ` · ${Math.round(v.timelock_s / 3600)} h delay before it runs` : ' · no delay before it runs'}</span></div>
      <p className={s.what}>{summary(v.actions)}</p>
      {v.explanation && <details className={s.ex}><summary>{firstSentence(v.explanation)}</summary><p>{v.explanation}</p></details>}
      <code className={s.addr}>#{v.tx_index} on {shortAddr(v.multisig)} · {shortAddr(v.address)}</code>
    </li>
  );
}

export default async function PendingPage() {
  const [votes, day] = await Promise.all([pendingActions({ relevantOnly: true, limit: 500 }), latestDay()]);
  const reg = day ? await registry(day) : [];
  const usd = new Map(reg.map((r) => [r.programId, { stage: r.stage, usd: r.usdFloor ?? 0 }]));
  const byAge = (a: Vote, b: Vote) => (a.status_at?.getTime() ?? 0) - (b.status_at?.getTime() ?? 0);
  const approved = votes.filter((v) => v.status === 'Approved').sort((a, b) => Number(isUpgrade(b)) - Number(isUpgrade(a)) || byAge(a, b));
  const active = votes.filter((v) => v.status !== 'Approved').sort(byAge);
  const oldest = days([...approved].sort(byAge)[0]?.status_at ?? null);
  return (
    <main className={s.wrap} data-device="vote-bars">
      <h1 className={s.h1}><span className={s.n}>{votes.length}</span> open votes right now would change who controls a program or move its funds.</h1>
      <p className={s.lede}>Read from every Squads v4 multisig that controls a covered program, every 30 minutes.{oldest != null ? ` The oldest approved vote has waited ${oldest} days and can still run.` : ''}</p>
      <section className={s.sec}>
        <h2>Approved, can run · {approved.length}</h2>
        <ol className={s.list}>{approved.map((v, i) => <Row key={v.address} v={v} i={i} usd={usd} />)}</ol>
      </section>
      <section className={s.sec}>
        <h2>Collecting signatures · {active.length}</h2>
        <ol className={s.list}>{active.map((v, i) => <Row key={v.address} v={v} i={i} usd={usd} />)}</ol>
      </section>
      <p className={s.muted}>Same data: <Link href="/api/v1/pending">/api/v1/pending</Link>. Explanations are written by Claude from the decoded transaction only.</p>
    </main>
  );
}
