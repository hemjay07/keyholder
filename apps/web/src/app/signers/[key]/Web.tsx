// File: apps/web/src/app/signers/[key]/Web.tsx
// The key at the centre, its multisigs on the inner ring, the programs they control on the outer ring. Rings draw
// outward in order (CSS stroke animation, one easing); reduced motion shows the finished web. Pure SVG, no JS.
import { programName, shortAddr } from '@/lib/program-names';
import s from './signer.module.css';

export interface WebMs { address: string; threshold: number; members: number; timelockS: number | null }
export interface WebProgram { programId: string; stage: number; vias: string[] }

const polar = (r: number, a: number) => [500 + r * Math.cos(a), 380 + r * Math.sin(a)] as const;
const stageFill = (n: number) => (n === 0 ? 'var(--signal)' : n >= 2 ? 'var(--signal-verified-on)' : 'var(--ink)');

export default function Web({ keyAddr, multisigs, programs }: { keyAddr: string; multisigs: WebMs[]; programs: WebProgram[] }) {
  const ang = new Map(multisigs.map((m, i) => [m.address, (i / Math.max(1, multisigs.length)) * Math.PI * 2 - Math.PI / 2]));
  const msPos = new Map([...ang].map(([k, a]) => [k, polar(170, a)]));
  // Each program sits on the outer ring at the mean angle of the multisigs that control it, then programs are
  // spread apart so labels never collide.
  const want = programs.map((p) => {
    const as = p.vias.map((v) => ang.get(v)).filter((x): x is number => x != null);
    const a = as.length ? Math.atan2(as.reduce((t, x) => t + Math.sin(x), 0), as.reduce((t, x) => t + Math.cos(x), 0)) : 0;
    return { ...p, a };
  }).sort((x, y) => x.a - y.a);
  const gap = Math.min(0.75, (Math.PI * 2) / Math.max(1, want.length));
  want.forEach((p, i) => { const prev = want[i - 1]; if (prev && p.a - prev.a < gap) p.a = prev.a + gap; });
  const prPos = want.map((p) => ({ ...p, at: polar(320, p.a) }));
  const edges = prPos.flatMap((p) => (p.vias.length ? p.vias : ['']).map((v) => ({ from: msPos.get(v) ?? ([500, 380] as const), to: p.at })));
  return (
    <svg className={s.web} viewBox="0 0 1000 760" role="img" aria-label={`Key ${shortAddr(keyAddr)}: ${multisigs.length} multisigs, ${programs.length} programs`} data-device="contagion-web">
      {edges.map((e, i) => <line key={`p${i}`} pathLength={1} className={s.l2} x1={e.from[0]} y1={e.from[1]} x2={e.to[0]} y2={e.to[1]} style={{ ['--i' as string]: i }} />)}
      {multisigs.map((m, i) => { const [x, y] = msPos.get(m.address)!; return <line key={`m${i}`} pathLength={1} className={s.l1} x1={500} y1={380} x2={x} y2={y} style={{ ['--i' as string]: i }} />; })}
      {multisigs.map((m, i) => {
        const [x, y] = msPos.get(m.address)!;
        return (
          <g key={m.address} className={s.n1} style={{ ['--i' as string]: i }}>
            <rect x={x - 62} y={y - 22} width={124} height={44} className={m.threshold === 1 ? s.alone : s.msBox} />
            <text x={x} y={y - 3} className={s.t1}>{m.threshold} of {m.members}</text>
            <text x={x} y={y + 13} className={s.t2}>{m.timelockS ? `${Math.round(m.timelockS / 3600)} h delay` : 'no delay'}</text>
          </g>
        );
      })}
      {prPos.map((p, i) => (
        <a key={p.programId} href={`/programs/${p.programId}`} className={s.n2} style={{ ['--i' as string]: i }}>
          <circle cx={p.at[0]} cy={p.at[1]} r={9} fill={stageFill(p.stage)} />
          <text x={p.at[0]} y={p.at[1] + 26} className={s.t3}>{programName(p.programId)}</text>
          <text x={p.at[0]} y={p.at[1] + 40} className={s.t2}>Stage {p.stage}</text>
        </a>
      ))}
      <g className={s.core}><circle cx={500} cy={380} r={30} /><text x={500} y={384}>{keyAddr.slice(0, 4)}</text></g>
    </svg>
  );
}
