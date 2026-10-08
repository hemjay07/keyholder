'use client';
// File: apps/web/src/components/stagemap/StageMap.tsx
// The home page's device: the Stage map canvas plus its DOM layer (hover card, pick panel, key tip).
// Signer facts load on the first pick (/api/v1/records?view=control), not with the page. Esc closes a pick.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Scene, keysOfFacts, PALETTES } from './scene';
import type { ControlFacts, MapProgram, Mark } from './types';
import { programName, shortAddr } from '@/lib/program-names';
import { formatUsd } from './format';
import s from './stagemap.module.css';

let controlLoad: Promise<Record<string, ControlFacts>> | null = null;
const loadControl = () =>
  (controlLoad ??= fetch('/api/v1/records?view=control')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`control ${r.status}`))))
    .then((j: { data: Record<string, ControlFacts> }) => j.data)
    .catch((e: unknown) => { controlLoad = null; throw e; }));

export interface StageMapProps { programs: MapProgram[]; pending: string[]; story?: boolean }

/** Inside the canvas: wakes the demand frame loop when the page scrolls. */
function WakeOnScroll() {
  const { invalidate } = useThree();
  useEffect(() => { const on = () => invalidate(); addEventListener('scroll', on, { passive: true }); return () => removeEventListener('scroll', on); }, [invalidate]);
  return null;
}

export default function StageMap({ programs, pending, story = false }: StageMapProps) {
  const [control, setControl] = useState<Record<string, ControlFacts>>({});
  const [picked, setPicked] = useState<MapProgram | null>(null);
  const [hover, setHover] = useState<Mark | null>(null);
  const [keyTip, setKeyTip] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [ptr, setPtr] = useState({ x: 0, y: 0, w: 0 });
  const pendingSet = useRef(new Set(pending)).current;
  const live = programs.filter((p) => !p.closed);
  // Follow the page theme (globals.css: system preference, or :root[data-theme]).
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const read = () => { const t = document.documentElement.dataset.theme; setTheme(t === 'dark' || (t !== 'light' && mq.matches) ? 'dark' : 'light'); };
    read(); mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, []);

  const pick = useCallback((p: MapProgram | null) => {
    if (!p) return setPicked(null);
    loadControl().then((c) => { setControl(c); setFailed(false); setPicked(p); }).catch(() => setFailed(true));
  }, []);

  // Ask answers name programs; the map picks the first one and comes into view (AskBox dispatches kh-pick).
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = (e: Event) => {
      const id = (e as CustomEvent<string>).detail, p = programs.find((x) => x.id === id);
      if (!p) return;
      pick(p);
      rootRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    };
    addEventListener('kh-pick', on);
    return () => removeEventListener('kh-pick', on);
  }, [programs, pick]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicked(null); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  // Scroll story: progress through the tall pinned section; the camera reads the ref each frame.
  const storyRef = useRef<HTMLDivElement>(null);
  const scroll = useRef(0);
  const [progress, setProgress] = useState(0);
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (!story) return;
    const on = () => {
      const el = storyRef.current; if (!el) return;
      const r = el.getBoundingClientRect(), span = el.offsetHeight - innerHeight;
      scroll.current = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
      setProgress(scroll.current);
    };
    on(); addEventListener('scroll', on, { passive: true }); addEventListener('resize', on);
    return () => { removeEventListener('scroll', on); removeEventListener('resize', on); };
  }, [story]);
  const go = (i: number) => { const el = storyRef.current; if (el) scrollTo({ top: el.offsetTop + (el.offsetHeight - innerHeight) * (i / 5), behavior: reduced ? 'auto' : 'smooth' }); };

  const canHover = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover)').matches;
  const map = (
    <div ref={rootRef} className={s.map} data-device="stage-map"
      onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPtr({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width }); }}>
      <Canvas onPointerMissed={() => setPicked(null)} frameloop="demand" shadows="percentage" dpr={[1, 1.5]} camera={{ fov: 20, near: 0.1, far: 200 }} gl={{ antialias: true }}>
        <Scene pal={PALETTES[theme]} programs={programs} pending={pendingSet} control={control} picked={picked} onHover={setHover} onPick={pick} onKey={setKeyTip} scroll={story ? scroll : undefined} />
        {story && <WakeOnScroll />}
      </Canvas>
      {keyTip && <div className={s.keytip}>{keyTip}<span>click to copy</span></div>}
      {failed && <div className={s.keytip}>Could not load signer keys. Try again.</div>}
      {!picked && hover && canHover && (
        <div className={s.tip} style={{ left: Math.min(ptr.x + 16, ptr.w - 260), top: ptr.y + 16 }}>
          <div className={s.nm}>{programName(hover.id)}</div>
          <div>Stage {hover.stage} · {hover.usd ? `${formatUsd(hover.usd)} traced` : 'no dollars traced'}</div>
          {pendingSet.has(hover.id) && <div className={s.warn}>open proposal on its controlling multisig</div>}
          <div className={s.hint}>click for its keys</div>
        </div>
      )}
      {story && !reduced && !picked && <Captions live={live} p={progress} />}
      {story && !reduced && !picked && <Rail p={progress} onGo={go} />}
      {picked && <Picked p={picked} live={live} control={control} onPick={pick} onClose={() => setPicked(null)} />}
    </div>
  );
  if (!story || reduced) return map;
  return <div ref={storyRef} className={s.story}><div className={s.pin}>{map}</div></div>;
}

/** One caption per close shot; counts and dollars computed from the record, never typed. */
function Captions({ live, p }: { live: MapProgram[]; p: number }) {
  const at = (n: number) => live.filter((x) => x.stage === n);
  const sum = (a: MapProgram[]) => formatUsd(a.reduce((t, x) => t + x.usd, 0));
  const kamino = live.find((x) => x.id === 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD');
  const lines: ([string, string] | null)[] = [
    null,
    [`Stage 0 · ${at(0).length} programs · ${sum(at(0))}`, 'One key can replace the code today. No second signer, no waiting period.'],
    [`Stage 1 · ${at(1).length} programs · ${sum(at(1))}`, `Several signers, but less than a day of notice.${kamino ? ` Kamino Lend's ${formatUsd(kamino.usd)} is here: its admin key is 4 of 10 with no timelock.` : ''}`],
    [`Stage 2 · ${at(2).length} programs · ${sum(at(2))}`, 'Every change waits 24 hours or more, long enough for users to see it coming and leave.'],
    [`Stage 3 · ${at(3).length} programs · ${sum(at(3))}`, 'Cannot be changed at all, or only after a seven-day exit window.'],
    null,
  ];
  const f = p * (lines.length - 1), i = Math.round(f), near = 1 - Math.min(1, Math.abs(f - i) * 2.2);
  const line = lines[i];
  return line ? <div className={s.caption} style={{ opacity: near }}><b>{line[0]}</b><span>{line[1]}</span></div> : null;
}

/** Where the climb is; a tick scrolls to that shot. */
function Rail({ p, onGo }: { p: number; onGo: (i: number) => void }) {
  const at = Math.round(p * 5);
  return (
    <nav className={s.rail} aria-label="Stages">
      {(['Map', '0', '1', '2', '3'] as const).map((l, i) => (
        <button key={l} className={at === i || (i === 0 && at === 5) ? s.on : ''} onClick={() => onGo(i)} aria-label={i ? `Stage ${l}` : 'Whole map'}><i />{l}</button>
      ))}
    </nav>
  );
}

/** Plain words for the rule that sets a program's stage (record stage.bindingPath). */
function bindingText(b: string): string {
  if (b === 'cap:admin_unknown') return 'Capped at Stage 1: its admin settings could not be read, so it cannot reach Stage 2 until they are.';
  if (b.startsWith('admin:')) return `Set by its admin key (${b.slice(6).replace('.', ' · ')}):`;
  if (b.startsWith('cap:')) return 'Capped:';
  return 'Set by its upgrade path:';
}

interface PickedProps { p: MapProgram; live: MapProgram[]; control: Record<string, ControlFacts>; onPick: (p: MapProgram) => void; onClose: () => void }

function Picked({ p, live, control, onPick, onClose }: PickedProps) {
  const c = control[p.id];
  const keys = keysOfFacts(c);
  const [copied, setCopied] = useState<string | null>(null);
  const shared = live.filter((x) => x.id !== p.id && keysOfFacts(control[x.id]).some((k) => keys.includes(k))).sort((a, b) => b.usd - a.usd);
  const tl = c?.ms?.timelockS;
  const delay = tl ? `${(tl / 3600).toFixed(tl % 3600 ? 1 : 0)} h` : 'none';
  const copy = (k: string) => { void navigator.clipboard?.writeText(k); setCopied(k); setTimeout(() => setCopied(null), 1200); };
  const capped = p.binding === 'cap:admin_unknown';
  return (
    <aside className={s.picked} aria-label={`${programName(p.id)} control`}>
      <button className={s.x} onClick={onClose} aria-label="Close (Esc)">×</button>
      <div className={s.nm}>{programName(p.id)}</div>
      <div>Stage {p.stage} · {p.usd ? `${formatUsd(p.usd)} traced` : 'no dollars traced'}</div>
      <p className={s.why}>{capped ? bindingText(p.binding) : <><span>{bindingText(p.binding)}</span> {c?.reason ?? ''}</>}</p>
      <dl>
        <dt className={s.h}>Upgrade path</dt>
        <dt>Authority</dt><dd>{c?.kind === 'squads_vault' ? `Squads ${c.ms?.version} multisig` : c?.kind.replace(/_/g, ' ') ?? 'unknown'}</dd>
        {c?.ms && <><dt>Threshold</dt><dd>{c.ms.threshold} of {c.ms.members}</dd><dt>Delay</dt><dd>{delay}</dd></>}
      </dl>
      <div className={s.h}>Keys · {keys.length}</div>
      <div className={s.chips}>
        {keys.map((k) => <button key={k} className={s.chip} title={k} onClick={() => copy(k)}>{copied === k ? 'copied' : shortAddr(k)}</button>)}
        {!keys.length && <span>none read</span>}
      </div>
      <div className={s.h}>Shares a key with · {shared.length}</div>
      <ul className={s.shared}>
        {shared.slice(0, 8).map((x) => <li key={x.id}><button onClick={() => onPick(x)}>{programName(x.id)}</button><span>Stage {x.stage}{x.usd ? ` · ${formatUsd(x.usd)}` : ''}</span></li>)}
        {!shared.length && <li><span>no other covered program</span></li>}
      </ul>
      <a className={s.more} href={`/programs/${p.id}`}>Full record →</a>
      <div className={s.id}>{p.id}</div>
    </aside>
  );
}
