// File: apps/web/src/app/page.tsx
// Home (design/proto/A.html, the founder's survivor 2026-10-08): the one figure, Ask, the Stage map, today's record
// as dated rows with their sources, and three ways to use the record. Sentences are design/TEN.md verbatim.
import Link from 'next/link';
import { latestDay, registry, pendingProgramIds } from '@/lib/records';
import StageMapLazy from '@/components/stagemap/StageMapLazy';
import AskBox from '@/components/AskBox';
import CountUp from '@/components/CountUp';
import type { MapProgram } from '@/components/stagemap/types';
import s from './home.module.css';

export const dynamic = 'force-dynamic';

async function mapData(): Promise<{ day: string | null; programs: MapProgram[]; pending: string[] }> {
  const day = await latestDay();
  if (!day) return { day: null, programs: [], pending: [] };
  const [rows, pending] = await Promise.all([registry(day), pendingProgramIds()]);
  const programs = rows.map((r) => ({ id: r.programId, stage: r.stage as MapProgram['stage'], usd: r.usdFloor ?? 0, binding: r.binding, closed: r.modifiers.includes('closed') }));
  return { day, programs, pending };
}

const RECORD: { when: string; text: React.ReactNode; src: string; href: string }[] = [
  { when: '2026-10-04', text: <>Of $2.66B traced vault by vault, <b className={s.h}>$1.89B</b> waits 24 hours or more before it can move; <b className={s.w}>$769M</b> waits for nothing.</>, src: 'dollars by class', href: '/keybench' },
  { when: '2026-10-08', text: <><b className={s.w}>360</b> programs sit at Stage 0: one key can change them.</>, src: '/api/v1/stages', href: '/api/v1/stages' },
  { when: '2026-10-08', text: <>The program built from Kamino&rsquo;s klend repo waits 24 hours to upgrade; its global admin, a <b className={s.w}>4-of-10</b> multisig, waits for nothing.</>, src: 'KLend2g3…YavgmjD', href: '/api/v1/programs/KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD' },
  { when: 'now', text: <><b className={s.w}>50</b> open votes right now would change who controls a program or move its funds.</>, src: '/api/v1/pending · 30 min', href: '/api/v1/pending' },
  { when: 'now', text: <>Two upgrades were approved <b className={s.w}>630 days</b> ago and can still run at any moment.</>, src: 'oldest approved vote', href: '/api/v1/pending' },
  { when: 'replay', text: <>Drift&rsquo;s first change landed <b>5.6 days</b> before the first drain; Keyholder&rsquo;s rules flag it the moment it lands.</>, src: 'KeyBench · Drift', href: '/keybench' },
];

export default async function HomePage() {
  let data: Awaited<ReturnType<typeof mapData>> = { day: null, programs: [], pending: [] };
  let readError = false;
  try { data = await mapData(); } catch (err) { console.error('HomePage: record read failed', err); readError = true; }
  const live = data.programs.filter((p) => !p.closed).length;
  return (
    <main>
      <section className={`${s.wrap} ${s.hero}`}>
        <div>
          <h1><span className={s.fig}>$<CountUp value={769} />M</span><span className={s.rest}>on Solana sits behind programs that can be upgraded with no waiting period.</span></h1>
          <p className={s.lede}>Keyholder reads 583 Solana programs to their signer keys, every day, and anchors the record on chain.</p>
        </div>
        <AskBox />
      </section>

      <section className={s.device} aria-label={`Stage map: ${live} programs on four stages of who can move their money`}>
        {data.programs.length > 0 ? <StageMapLazy programs={data.programs} pending={data.pending} /> : <p className={s.missing}>{readError ? 'The record could not be read just now.' : 'No record day has been built yet.'}</p>}
      </section>
      <div className={`${s.wrap} ${s.cap}`}>
        <span>Each column is one program on its stage; height is the dollars traced to it. Click one for its keys.{data.day ? ` Record of ${data.day}.` : ''}</span>
        <span>Four rungs, public rules.</span>
      </div>

      <section className={s.wrap}>
        <h2>Who can move it, how fast, and did that change?</h2>
        <p className={s.sub}>Today&rsquo;s record, read from chain. Every figure links to the record it came from.</p>
        <div className={s.recs}>
          {RECORD.map((r, i) => (
            <div key={i} className={s.rec}><time>{r.when}</time><p>{r.text}</p><Link className={s.src} href={r.href}>{r.src}</Link></div>
          ))}
        </div>
      </section>

      <section className={s.wrap}>
        <h2>Count the keys.</h2>
        <p className={s.sub}>Three ways to use the record.</p>
        <div className={s.build}>
          <div className={s.card}><h3>Refuse weak control on chain</h3><p>Any program can refuse money where control is weak, with one line: require_stage.</p><pre>keyholder::require_stage(ctx, 2, 86_400)?;</pre><Link className={s.go} href="/policy">Build with it →</Link></div>
          <div className={s.card}><h3>Ask the record</h3><p>Ask in plain words; every answer cites the program, key or transaction it came from.</p><pre>GET /api/v1/programs/KLend2g3…</pre><Link className={s.go} href="/api/v1/stages">Read the API →</Link></div>
          <div className={s.card}><h3>Hold teams to their word</h3><p>A team states its control; the chain checks it every day; a broken promise is news the same day.</p><pre>claim: stage ≥ 2 · checked daily</pre><Link className={s.go} href="/api/v1/claims">See the claims →</Link></div>
        </div>
      </section>

      <footer className={`${s.wrap} ${s.foot}`}>
        <span><b>Keyholder</b> · the control record for Solana</span>
        <span>Who can move it, how fast, and did that change? · Four rungs, public rules. · Count the keys.</span>
      </footer>
    </main>
  );
}
