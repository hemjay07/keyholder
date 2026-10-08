// File: apps/web/src/app/programs/page.tsx
// Every covered program, by who can move its money (design/CHARTER.md /programs). Sidebar: the stage distribution
// (the page's device, it fills on load), dollars per stage, filters. Main: search, paged table. All state is in the
// URL (?stage, ?delay=none, ?votes=1, ?q, ?page, ?per) so every view links and the back button works.
import Link from 'next/link';
import { latestDay, registry, pendingProgramIds } from '@/lib/records';
import { programName, PROGRAM_NAMES } from '@/lib/program-names';
import { formatUsd } from '@/components/stagemap/format';
import Pager, { paginate } from '@/components/Pager';
import s from './programs.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Programs', description: 'Every covered Solana program, by who can move its money.' };

type Q = { stage?: string; delay?: string; votes?: string; q?: string; page?: string; per?: string };
const STAGE_TEXT = ['one key', 'no real delay', '24 h+ delay', 'cannot change, or 7 days'];

function href(patch: Partial<Q>): string {
  const p = new URLSearchParams(Object.entries(patch).filter(([, v]) => v) as [string, string][]);
  return p.toString() ? `/programs?${p}` : '/programs';
}
/** 0 or null: no delay; under an hour in minutes; else hours. */
const fmtDelay = (t: number | null) => (!t ? 'no delay' : t < 3600 ? `${Math.max(1, Math.round(t / 60))} min` : `${Math.round(t / 3600)} h`);
const bound = (b: string) => (b === 'upgrade' ? 'upgrade path' : b === 'cap:admin_unknown' ? 'admin unread' : b.startsWith('admin:') ? `admin · ${b.slice(6).split('.')[1] ?? b.slice(6)}` : b);

function Glyph({ stage }: { stage: number }) {
  return <span className={s.glyph} aria-label={`Stage ${stage}`}>{[0, 1, 2, 3].map((r) => <i key={r} className={r <= stage ? (stage === 0 ? s.g0 : stage >= 2 ? s.g2 : s.g1) : ''} />)}</span>;
}

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const day = await latestDay();
  const [rows, pending] = day ? await Promise.all([registry(day), pendingProgramIds()]) : [[], []];
  const votes = new Set(pending);
  const live = rows.filter((r) => !r.modifiers.includes('closed'));
  const stageQ = q.stage != null && /^[0-3]$/.test(q.stage) ? Number(q.stage) : null;
  const needle = q.q?.trim().toLowerCase() ?? '';
  const shown = live
    .filter((r) => stageQ == null || r.stage === stageQ)
    .filter((r) => q.delay !== 'none' || r.stage <= 1)
    .filter((r) => !q.votes || votes.has(r.programId))
    .filter((r) => !needle || r.programId.toLowerCase().includes(needle) || (PROGRAM_NAMES[r.programId]?.toLowerCase().includes(needle) ?? false))
    .sort((a, b) => (b.usdFloor ?? 0) - (a.usdFloor ?? 0));
  const pg = paginate(shown.length, q.page, q.per);
  const list = shown.slice(pg.from, pg.to);
  const by = [0, 1, 2, 3].map((n) => { const r = live.filter((x) => x.stage === n); return { n, count: r.length, usd: r.reduce((t, x) => t + (x.usdFloor ?? 0), 0) }; });
  const filters = { stage: q.stage, delay: q.delay, votes: q.votes, q: q.q, per: q.per };
  const voteCount = live.filter((r) => votes.has(r.programId)).length;
  return (
    <main className={s.wrap}>
      <header className={s.head}>
        <h1 className={s.h1}>Every program, by who can move its money</h1>
        <p className={s.lede}>{live.length} live programs on the record of {day ?? '—'}. The weakest control path sets each stage; the <Link href="/api/v1/stages">rules are public</Link>.</p>
      </header>
      <div className={s.layout}>
        <aside className={s.side}>
          <div className={s.dist} data-device="stage-distribution" aria-label="Programs per stage">
            {by.map((b) => <i key={b.n} className={b.n === 0 ? s.g0 : b.n >= 2 ? s.g2 : s.g1} style={{ ['--w' as string]: b.count / Math.max(1, live.length), ['--d' as string]: b.n }} />)}
          </div>
          <ul className={s.stages}>
            {by.map((b) => (
              <li key={b.n}>
                <Link className={stageQ === b.n ? s.on : ''} href={href({ stage: String(b.n) })}>
                  <Glyph stage={b.n} /><span className={s.sn}>Stage {b.n}<small>{STAGE_TEXT[b.n]}</small></span><span className={s.sc}>{b.count}<small>{b.usd ? formatUsd(b.usd) : '—'}</small></span>
                </Link>
              </li>
            ))}
          </ul>
          <div className={s.toggles}>
            <Link className={stageQ == null && !q.delay && !q.votes && !needle ? s.on : ''} href="/programs">All programs</Link>
            <Link className={q.delay === 'none' ? s.on : ''} href={href({ delay: 'none' })}>Less than a day of notice</Link>
            <Link className={q.votes ? s.on : ''} href={href({ votes: '1' })}>With an open vote · {voteCount}</Link>
          </div>
        </aside>
        <section className={s.main}>
          <form className={s.search} action="/programs" role="search">
            {Object.entries({ stage: q.stage, delay: q.delay, votes: q.votes }).map(([k, v]) => v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
            <input name="q" defaultValue={q.q ?? ''} placeholder="Name or program address" aria-label="Search programs" autoComplete="off" />
            <button>Search</button>
          </form>
          <Pager base="/programs" query={filters} noun="programs" {...pg} />
          <table className={s.table}>
            <colgroup><col className={s.c1} /><col /><col className={s.c3} /><col className={s.c4} /><col className={s.c5} /></colgroup>
            <thead><tr><th>Stage</th><th>Program</th><th>Set by</th><th>Upgrade control</th><th className={s.num}>Traced</th></tr></thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.programId} style={{ ['--i' as string]: Math.min(i, 30) }}>
                  <td><Glyph stage={r.stage} /></td>
                  <td><Link href={`/programs/${r.programId}`}>{programName(r.programId)}</Link>{votes.has(r.programId) && <span className={s.vote}>open vote</span>}</td>
                  <td className={s.muted}>{bound(r.binding)}</td>
                  <td>{r.threshold != null ? <>{r.threshold} of {r.members} · <span className={!r.timelockS ? s.weak : r.timelockS >= 86400 ? s.holds : ''}>{fmtDelay(r.timelockS)}</span></> : <span className={s.muted}>{r.upgradeKind === 'single_key_or_vault_unresolved' ? 'key, unresolved' : r.upgradeKind.replace(/_/g, ' ')}</span>}</td>
                  <td className={s.num}>{r.usdFloor ? formatUsd(r.usdFloor) : <span className={s.muted}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <p className={s.empty}>No program matches. <Link href="/programs">Clear filters</Link></p>}
          <Pager base="/programs" query={filters} noun="programs" {...pg} />
        </section>
      </div>
    </main>
  );
}
