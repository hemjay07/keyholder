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
  const tone = stage === 0 ? s.weakText : stage >= 2 ? s.holdsText : '';
  return (
    <main className={s.wrap}>
      <p className={s.crumb}><Link href="/programs">Programs</Link> / {name}</p>
      <h1 className={s.h1}>{name}: <span className={tone}>Stage {stage}</span>, {boundBy(record.stage.bindingPath)}</h1>
      <div className={s.layout}>
        <div className={s.main}>
          <section className={s.sec}>
            <h2>Who can change it</h2>
            <p className={s.sub}>Every control path; the weakest sets the stage. The {record.stage.rulesVersion} rules are <Link href="/stages">public</Link>.</p>
            <ControlChain record={record} />
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
            <h2>Changes · {events.length}</h2>
            {events.length ? (
              <ul className={s.list}>{events.map((e) => <li key={e.id}><time>{e.day}</time><span>{KIND[e.kind] ?? e.kind.replace(/_/g, ' ')}</span><span className={s.muted}>{e.path}</span></li>)}</ul>
            ) : <p className={s.muted}>No change recorded since daily records began on 2026-10-02.</p>}
          </section>
        </div>

        <aside className={s.side}>
          <div className={s.card} data-device="stage-card">
            <span className={s.k}>Control Stage</span>
            <b className={`${s.big} ${tone}`}>{stage}</b>
            <p className={s.why}>{record.stage.paths.find((x) => x.path === record.stage.bindingPath)?.reason ?? record.stage.cap?.reason ?? ''}</p>
            <ol className={s.ladder} aria-label="Stage by rung">{[3, 2, 1, 0].map((n) => <li key={n} className={n === stage ? s.here : ''}><i />Stage {n}</li>)}</ol>
          </div>
          <dl className={s.facts}>
            <div><dt>Money traced</dt><dd>{record.usdFloor ? `at least ${formatUsd(record.usdFloor)}` : 'none traced'}</dd></div>
            <div><dt>Built from</dt><dd>{record.repo ? <a href={record.repo}>{record.repo.replace(/^https:\/\/github.com\//, '').split('/tree/')[0]}</a> : 'not verified'}</dd></div>
            <div><dt>Record day</dt><dd>{day}, anchored</dd></div>
            <div><dt>Program</dt><dd><code className={s.addr}>{id}</code></dd></div>
          </dl>
          <div>
            <h3 className={s.h3}>Stage by day</h3>
            <ol className={s.days}>{history.map((h) => <li key={h.day} className={h.stage === 0 ? s.weak : h.stage >= 2 ? s.holds : ''} title={`${h.day}: Stage ${h.stage}`}><span>{h.stage}</span><time>{h.day.slice(5)}</time></li>)}</ol>
          </div>
          <div>
            <h3 className={s.h3}>Shares signers with · {shared.length}</h3>
            {shared.length ? <ul className={s.shared}>{shared.slice(0, 8).map((c) => (
              <li key={c.programId}><Link href={`/programs/${c.programId}`}>{programName(c.programId)}</Link><span>{c.sharedSigners} keys · {c.row ? `Stage ${c.row.stage}` : ''}</span></li>
            ))}</ul> : <p className={s.muted}>No other covered program shares two or more of its signers.</p>}
          </div>
          <pre className={s.pre}>{`GET /api/v1/programs/${shortAddr(id)}\nkeyholder::require_stage(ctx, 2, 86_400)?;`}</pre>
        </aside>
      </div>
    </main>
  );
}
