// File: apps/web/src/app/stages/page.tsx
// The public Control Stage rules (design/CHARTER.md /stages): one ladder, each rung with its rule, how a program
// moves up, how many programs and dollars sit on it today, and its largest programs. Sidebar: how the stage is
// computed (weakest path wins, caps), rules version and the API.
import Link from 'next/link';
import { STAGE_RULES, RULES_VERSION } from '@keyholder/stages';
import { latestDay, registry } from '@/lib/records';
import { programName } from '@/lib/program-names';
import { formatUsd } from '@/components/stagemap/format';
import s from './stages.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Control Stages', description: 'Four rungs, public rules: how Keyholder decides who can move a Solana program’s money, and how fast.' };

const TONE = ['weak', 'plain', 'holds', 'holds'] as const;

export default async function StagesPage() {
  const day = await latestDay();
  const rows = day ? (await registry(day)).filter((r) => !r.modifiers.includes('closed')) : [];
  const total = rows.length || 1;
  const rungs = STAGE_RULES.map((r) => {
    const on = rows.filter((x) => x.stage === r.stage).sort((a, b) => (b.usdFloor ?? 0) - (a.usdFloor ?? 0));
    return { ...r, count: on.length, usd: on.reduce((t, x) => t + (x.usdFloor ?? 0), 0), top: on.slice(0, 5) };
  });
  return (
    <main className={s.wrap}>
      <h1 className={s.h1}>Four rungs, public rules.</h1>
      <p className={s.lede}>A program&rsquo;s stage says who can change it and how much warning its users get. Every rule is published, versioned and applied the same way to all {rows.length} programs, every day.</p>
      <div className={s.layout}>
        <ol className={s.ladder} data-device="stage-ladder">
          {[...rungs].reverse().map((r, i) => (
            <li key={r.stage} className={`${s.rung} ${s[TONE[r.stage]]}`} style={{ ['--i' as string]: i, ['--share' as string]: r.count / total }}>
              <div className={s.num}>{r.stage}</div>
              <div className={s.body}>
                <h2>{r.name}</h2>
                <p className={s.rule}>{r.rule}</p>
                {r.moveUp ? <p className={s.up}><b>To move up:</b> {r.moveUp}</p> : <p className={s.up}><b>Top rung.</b> Users can always leave before a change lands.</p>}
                {r.top.length > 0 && <ul className={s.top}>{r.top.map((x) => <li key={x.programId}><Link href={`/programs/${x.programId}`}>{programName(x.programId)}</Link>{x.usdFloor ? <span>{formatUsd(x.usdFloor)}</span> : null}</li>)}{r.count > 5 && <li className={s.all}><Link href={`/programs?stage=${r.stage}`}>All {r.count} →</Link></li>}</ul>}
              </div>
              <div className={s.stat}>
                <b>{r.count}</b><span>programs</span>
                <b className={s.usd}>{r.usd ? formatUsd(r.usd) : '—'}</b><span>traced</span>
                <i className={s.bar} aria-hidden="true" />
              </div>
            </li>
          ))}
        </ol>
        <aside className={s.side}>
          <h3>How a stage is set</h3>
          <ol className={s.how}>
            <li><b>Every control path is read.</b> The upgrade authority, and every program-wide admin key the program&rsquo;s IDL exposes.</li>
            <li><b>Each path gets a stage</b> from its signers and its delay: one key, several keys with no 24 h wait, a 24 h+ wait, or 7 days / immutable.</li>
            <li><b>The weakest path wins.</b> A 24 h upgrade timelock does not help if an admin key can act at once.</li>
            <li><b>Unread means capped.</b> If admin fields cannot be read, the program stays at Stage 1 at most until they can.</li>
          </ol>
          <dl className={s.meta}>
            <div><dt>Rules version</dt><dd>{RULES_VERSION}</dd></div>
            <div><dt>Stage 2 needs</dt><dd>24 h delay on every path</dd></div>
            <div><dt>Stage 3 needs</dt><dd>7 days, or immutable</dd></div>
            <div><dt>Record day</dt><dd>{day ?? '—'}, anchored on chain</dd></div>
          </dl>
          <pre className={s.pre}>{`GET /api/v1/stages\n\n// enforce it on chain\nkeyholder::require_stage(ctx, 2, 86_400)?;`}</pre>
        </aside>
      </div>
    </main>
  );
}
