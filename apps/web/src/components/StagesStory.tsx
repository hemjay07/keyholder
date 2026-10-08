'use client';
// File: apps/web/src/components/StagesStory.tsx
// "Four ways a program can change" (design/STAGES-STORY.md): a pinned scroll sequence, one scene per stage, each told
// with a real program from the day's record. Each scene animates its two defining facts in order: the keys that must
// turn (drawn as keys), then the clock between "change approved" and "change lands", with the depositor's exit marked.
// Reduced motion: the four scenes stand still, stacked.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatUsd } from './stagemap/format';
import s from './stagesstory.module.css';

export interface StageScene {
  stage: 0 | 1 | 2 | 3;
  count: number;
  usd: number;
  example: { id: string; name: string; usd: number | null; threshold: number | null; members: number | null; timelockS: number | null; immutable: boolean } | null;
}

const COPY = [
  { title: 'One key', line: 'One person can replace the code, today.', exit: 'You find out after it happened.' },
  { title: 'A few keys, no wait', line: 'Several signers must agree, but the change lands the moment they do.', exit: 'More people, same surprise.' },
  { title: 'Keys and a waiting period', line: 'Every change waits at least 24 hours before it takes effect.', exit: 'You see it coming and can leave first.' },
  { title: 'Cannot be changed', line: 'The code is frozen, or any change waits seven days or more.', exit: 'Nothing can move under you.' },
];

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const hours = (t: number | null) => (!t ? '0 h' : `${Math.round(t / 3600)} h`);

function Keys({ n, need, turned }: { n: number; need: number; turned: number }) {
  return (
    <div className={s.keys} aria-label={`${need} of ${n} keys`}>
      {Array.from({ length: n }, (_, i) => {
        const on = i < need && turned > i / Math.max(1, need);
        return (
          <svg key={i} viewBox="0 0 24 48" className={`${s.key} ${i < need ? s.needed : ''} ${on ? s.on : ''}`} style={{ transitionDelay: `${i * 40}ms` }} aria-hidden="true">
            <circle cx="12" cy="10" r="7" /><circle cx="12" cy="10" r="2.5" className={s.hole} />
            <rect x="10.5" y="17" width="3" height="26" /><rect x="13.5" y="34" width="5" height="3" /><rect x="13.5" y="39" width="4" height="3" />
          </svg>
        );
      })}
    </div>
  );
}

function Scene({ sc, t }: { sc: StageScene; t: number }) {
  const c = COPY[sc.stage]!;
  const ex = sc.example;
  const members = sc.stage === 0 ? 1 : ex?.members ?? 5, need = sc.stage === 0 ? 1 : ex?.threshold ?? 3;
  const keysT = ease(t / 0.4), clockT = ease((t - 0.42) / 0.38), outT = ease((t - 0.82) / 0.18);
  const delayH = sc.stage === 3 ? 168 : sc.stage === 2 ? Math.max(24, Math.round((ex?.timelockS ?? 86400) / 3600)) : 0;
  const tone = sc.stage === 0 || sc.stage === 1 ? s.weak : s.holds;
  return (
    <div className={s.scene}>
      <div className={s.copy}>
        <p className={s.kicker}>Stage {sc.stage}</p>
        <h3 className={s.title}>{c.title}</h3>
        <p className={s.line}>{c.line}</p>
        {ex && <p className={s.example}>Today: <Link href={`/programs/${ex.id}`}>{ex.name}</Link>{ex.usd ? `, ${formatUsd(ex.usd)}` : ''}{sc.stage === 0 ? ', one key' : sc.stage === 3 ? (ex.immutable ? ', frozen' : '') : ex.threshold != null ? `, ${ex.threshold} of ${ex.members} keys, ${hours(ex.timelockS)} wait` : ''}.</p>}
        <p className={`${s.count} ${tone}`} style={{ transform: `translateY(${(1 - outT) * 8}px)`, opacity: 0.25 + 0.75 * outT }}>
          <b>{sc.count}</b> programs{sc.usd ? <> · <b>{formatUsd(sc.usd)}</b></> : null} at Stage {sc.stage}
        </p>
      </div>
      <div className={s.instrument}>
        <div className={s.row}>
          <span className={s.label}>Who must agree</span>
          {sc.stage === 3 ? <div className={s.lock} style={{ ['--k' as string]: keysT }}><svg viewBox="0 0 40 48" aria-hidden="true"><path d="M10 22v-8a10 10 0 0 1 20 0v8" /><rect x="5" y="22" width="30" height="22" /></svg><span>No key can change it</span></div> : <><Keys n={members} need={need} turned={keysT} /><span className={s.value}>{need} of {members}</span></>}
        </div>
        <div className={s.row}>
          <span className={s.label}>From approval to effect</span>
          {sc.stage <= 1 ? (
            <div className={s.track}>
              <span className={s.mark} style={{ left: 0 }}><b>approved = takes effect</b></span>
              <i className={`${s.flash} ${tone}`} style={{ opacity: clockT, transform: `scale(${0.6 + 0.4 * clockT})` }} />
              <span className={`${s.noexit} ${tone}`} style={{ opacity: outT }}>no time to leave</span>
            </div>
          ) : (
            <div className={s.track}>
              <span className={s.mark} style={{ left: 0 }}><b>approved</b></span>
              <i className={`${s.fill} ${tone}`} style={{ transform: `scaleX(${clockT})` }} />
              <span className={s.exit} style={{ left: `${Math.max(8, clockT * 70)}%`, opacity: outT }}>you can withdraw</span>
              <span className={`${s.mark} ${s.end}`} style={{ left: '100%' }}><b>takes effect</b></span>
            </div>
          )}
          <span className={s.value}>{sc.stage === 3 ? '7 d +' : `${delayH} h`}</span>
        </div>
        <p className={`${s.verdict} ${tone}`} style={{ opacity: 0.2 + 0.8 * outT }}>{c.exit}</p>
      </div>
    </div>
  );
}

export default function StagesStory({ scenes }: { scenes: StageScene[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(matchMedia('(prefers-reduced-motion: reduce)').matches);
    const on = () => { const el = ref.current; if (!el) return; const r = el.getBoundingClientRect(), span = el.offsetHeight - innerHeight; setP(span > 0 ? clamp(-r.top / span) : 0); };
    on(); addEventListener('scroll', on, { passive: true }); addEventListener('resize', on);
    return () => { removeEventListener('scroll', on); removeEventListener('resize', on); };
  }, []);
  if (still) return <section className={s.stack} aria-label="Four ways a program can change">{scenes.map((sc) => <Scene key={sc.stage} sc={sc} t={1} />)}</section>;
  const f = p * scenes.length, i = Math.min(scenes.length - 1, Math.floor(f)), t = f - i;
  return (
    <section ref={ref} className={s.story} style={{ height: `${scenes.length * 110 + 20}vh` }} aria-label="Four ways a program can change">
      <div className={s.pin}>
        <div className={s.head}>
          <h2>Four ways a program can change</h2>
          <ol className={s.steps}>{scenes.map((sc, j) => <li key={sc.stage} className={j === i ? s.cur : j < i ? s.done : ''}><span>Stage {sc.stage}</span><i style={{ transform: `scaleX(${j < i ? 1 : j === i ? t : 0})` }} /></li>)}</ol>
        </div>
        <div className={s.frame}><Scene key={scenes[i]!.stage} sc={scenes[i]!} t={Math.min(1, t * 1.25)} /></div>
      </div>
    </section>
  );
}
