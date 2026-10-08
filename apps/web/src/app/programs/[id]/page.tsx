// File: apps/web/src/app/programs/[id]/page.tsx
// One program's control record (design/CHARTER.md /programs/[id]): its stage and the path that sets it, every control
// path drawn as a chain, its stage by day, open votes on the multisigs that control it, programs that share its keys,
// and every recorded change. All read from the Control Record for the latest built day.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { latestDay, programRecord, stageHistory, changes, pendingActions, registry } from '@/lib/records';
import { programName, shortAddr } from '@/lib/program-names';
import { formatUsd } from '@/components/stagemap/format';
import ControlChain from './ControlChain';
import s from './program.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: programName(id), description: `Who can change ${programName(id)} on Solana, how fast, and whether that changed.` };
}

function boundBy(binding: string): string {
  if (binding === 'upgrade') return 'bound by its upgrade path';
  if (binding === 'cap:admin_unknown') return 'held there because its admin settings could not be read';
  if (binding.startsWith('admin:')) return 'bound by its admin key';
  return 'capped';
}

const ago = (d: Date | null) => {
  if (!d) return 'date unknown';
  const n = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  return n === 0 ? 'today' : `${n} day${n === 1 ? '' : 's'} ago`;
};

/** "3 calls to ProgM6…nk7S · 2 calls to an unlisted program", from the decoded vault transaction. */
function actionSummary(actions: unknown): string {
  if (!Array.isArray(actions) || !actions.length) return '';
  const by = new Map<string, number>();
  for (const a of actions as { type?: string; program?: string }[]) {
    const k = a.type && a.type !== 'call' ? a.type.replace(/_/g, ' ') : a.program && a.program !== 'unknown' ? `calls to ${shortAddr(a.program)}` : 'calls to an unlisted program';
    by.set(k, (by.get(k) ?? 0) + 1);
  }
  return [...by].map(([k, n]) => `${n} ${n === 1 ? k.replace(/^calls/, 'call') : k}`).join(' · ');
}
const KIND: Record<string, string> = { pending_control_action: 'Open vote opened', program_closed: 'Program closed', members_changed: 'Signers changed', stage_changed: 'Stage changed', timelock_changed: 'Delay changed', threshold_changed: 'Threshold changed', authority_changed: 'Authority changed', claim_broken: 'Claim broken' };

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const day = await latestDay();
  const record = day ? await programRecord(id, day) : null;
  if (!day || !record) notFound();
  const [history, events, votes, reg] = await Promise.all([stageHistory(id), changes({ programId: id, limit: 100 }), pendingActions({ programId: id, relevantOnly: true, limit: 50 }), registry(day)]);
  const usdById = new Map(reg.map((r) => [r.programId, r]));
  const stage = record.stage.stage, name = programName(id);
  const shared = (record.contagion ?? []).map((c) => ({ ...c, row: usdById.get(c.programId) })).sort((a, b) => (b.row?.usdFloor ?? 0) - (a.row?.usdFloor ?? 0));
  return (
    <main className={s.wrap}>
      <p className={s.crumb}><Link href="/">Stage map</Link> / Program</p>
      <h1 className={s.h1}>{name}: <span className={stage === 0 ? s.weakText : stage >= 2 ? s.holdsText : ''}>Stage {stage}</span>, {boundBy(record.stage.bindingPath)}</h1>
      <p className={s.lede}>
        {record.usdFloor ? <><b>{formatUsd(record.usdFloor)}</b> traced to it. </> : 'No dollars traced to it. '}
        {record.repo ? <>Built from <a href={record.repo}>{record.repo.replace(/^https:\/\/github.com\//, '').split('/tree/')[0]}</a>. </> : null}
        Record of {day}, anchored on chain.
      </p>
      <code className={s.addr}>{id}</code>

      <section className={s.sec}>
        <h2>Who can change it</h2>
        <p className={s.sub}>Every control path, weakest sets the stage. {record.stage.rulesVersion} rules are <Link href="/api/v1/stages">public</Link>.</p>
        <ControlChain record={record} />
      </section>

      <section className={s.sec}>
        <h2>Stage by day</h2>
        <ol className={s.days}>
          {history.map((h) => <li key={h.day} className={h.stage === 0 ? s.weak : h.stage >= 2 ? s.holds : ''} title={`${h.day}: Stage ${h.stage}`}><span>{h.stage}</span><time>{h.day.slice(5)}</time></li>)}
        </ol>
      </section>

      <section className={s.sec}>
        <h2>Open votes · {votes.length}</h2>
        {votes.length ? votes.map((v) => (
          <div key={v.address} className={s.vote}>
            <div className={s.voteHead}><b className={s.weakText}>{v.status}</b><span>{v.approvals} approval{v.approvals === 1 ? '' : 's'}, {v.threshold ?? '?'} needed · {v.status.toLowerCase()} {ago(v.status_at)}</span><code>#{v.tx_index} · {shortAddr(v.multisig)}</code></div>
            {v.explanation ? <p>{v.explanation}</p> : <p className={s.muted}>Not explained yet. Decoded: {actionSummary(v.actions) || 'no actions'}.</p>}
          </div>
        )) : <p className={s.muted}>No open vote on a multisig that controls this program.</p>}
      </section>

      <section className={s.sec}>
        <h2>Shares signers with · {shared.length}</h2>
        {shared.length ? (
          <ul className={s.list}>{shared.map((c) => (
            <li key={c.programId}><Link href={`/programs/${c.programId}`}>{programName(c.programId)}</Link><span>{c.sharedSigners} shared key{c.sharedSigners === 1 ? '' : 's'}</span><span>{c.row ? `Stage ${c.row.stage}${c.row.usdFloor ? ` · ${formatUsd(c.row.usdFloor)}` : ''}` : ''}</span></li>
          ))}</ul>
        ) : <p className={s.muted}>No other covered program shares two or more of its signers.</p>}
      </section>

      <section className={s.sec}>
        <h2>Changes · {events.length}</h2>
        {events.length ? (
          <ul className={s.list}>{events.map((e) => <li key={e.id}><time>{e.day}</time><span>{KIND[e.kind] ?? e.kind.replace(/_/g, ' ')}</span><span className={s.muted}>{e.path}</span></li>)}</ul>
        ) : <p className={s.muted}>No change recorded since daily records began on 2026-10-02.</p>}
      </section>

      <section className={s.sec}>
        <h2>Use this record</h2>
        <pre className={s.pre}>{`curl https://keyholder-ashy.vercel.app/api/v1/programs/${id}\n\n// in your program\nkeyholder::require_stage(ctx, 2, 86_400)?;`}</pre>
      </section>
    </main>
  );
}
