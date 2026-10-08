'use client';
// File: apps/web/src/components/BuildSim.tsx
// require_stage simulator: pick the minimum stage and delay your program will accept; see, from today's record, which
// covered programs pass and how much money they hold, and copy the exact call. Uses the upgrade-path stage, which is
// what the on-chain check reads (programs/keyholder require_stage).
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatUsd } from './stagemap/format';
import s from './buildsim.module.css';

export interface SimRow { id: string; name: string; stage: number | null; timelockS: number | null; usd: number }

const DELAYS = [{ s: 0, l: 'any' }, { s: 3600, l: '1 h' }, { s: 86400, l: '24 h' }, { s: 172800, l: '48 h' }, { s: 604800, l: '7 d' }];
const STAGE_NAME = ['one key', 'no delay', 'delayed', 'exit window'];

export default function BuildSim({ rows }: { rows: SimRow[] }) {
  const [minStage, setMinStage] = useState(2);
  const [minDelay, setMinDelay] = useState(86400);
  const [show, setShow] = useState<'pass' | 'refuse'>('pass');
  // The meter fills from empty once on load, then follows the policy.
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 350); return () => clearTimeout(t); }, []);
  const res = useMemo(() => {
    const pass = rows.filter((r) => r.stage != null && r.stage >= minStage && (r.stage === 3 || (r.timelockS ?? 0) >= minDelay));
    const ids = new Set(pass.map((r) => r.id));
    const refuse = rows.filter((r) => !ids.has(r.id));
    const sum = (a: SimRow[]) => a.reduce((t, r) => t + r.usd, 0);
    return { pass, refuse, passUsd: sum(pass), refuseUsd: sum(refuse) };
  }, [rows, minStage, minDelay]);
  const list = (show === 'pass' ? res.pass : res.refuse).slice().sort((a, b) => b.usd - a.usd).slice(0, 12);
  const share = res.pass.length / Math.max(1, rows.length);
  const code = `// before your program moves user funds into ${'<'}target${'>'}\nkeyholder::cpi::require_stage(\n    CpiContext::new(keyholder_program, RequireStage {\n        target_program, programdata, multisig,\n    }),\n    ${minStage},          // minimum Control Stage\n    ${minDelay.toLocaleString('en-US').replace(/,/g, '_')},   // minimum delay, seconds\n)?;`;
  return (
    <div className={s.sim} data-device="require-stage-sim">
      <div className={s.controls}>
        <div>
          <span className={s.k}>Minimum stage</span>
          <div className={s.seg} role="radiogroup" aria-label="Minimum stage">
            {[0, 1, 2, 3].map((n) => <button key={n} role="radio" aria-checked={minStage === n} className={minStage === n ? s.on : ''} onClick={() => setMinStage(n)}><b>{n}</b><small>{STAGE_NAME[n]}</small></button>)}
          </div>
        </div>
        <div>
          <span className={s.k}>Minimum delay</span>
          <div className={s.seg} role="radiogroup" aria-label="Minimum delay">
            {DELAYS.map((d) => <button key={d.s} role="radio" aria-checked={minDelay === d.s} className={minDelay === d.s ? s.on : ''} onClick={() => setMinDelay(d.s)}><b>{d.l}</b></button>)}
          </div>
        </div>
      </div>
      <div className={s.result}>
        <div className={s.meter} aria-hidden="true"><i style={{ transform: `scaleX(${shown ? share : 0})` }} /></div>
        <div className={s.nums}>
          <button className={`${s.num} ${show === 'pass' ? s.sel : ''}`} onClick={() => setShow('pass')}><b className={s.holds}>{res.pass.length}</b><span>programs accepted · {formatUsd(res.passUsd)}</span></button>
          <button className={`${s.num} ${show === 'refuse' ? s.sel : ''}`} onClick={() => setShow('refuse')}><b className={s.weak}>{res.refuse.length}</b><span>refused on chain · {formatUsd(res.refuseUsd)}</span></button>
        </div>
        <ul className={s.list}>
          {list.map((r) => <li key={r.id}><Link href={`/programs/${r.id}`}>{r.name}</Link><span>{r.stage == null ? 'upgrade path unread' : `upgrade path Stage ${r.stage}${r.timelockS ? ` · ${Math.round(r.timelockS / 3600)} h` : ''}`}</span><span>{r.usd ? formatUsd(r.usd) : ''}</span></li>)}
          {!list.length && <li><span>None today.</span></li>}
        </ul>
      </div>
      <pre className={s.code}>{code}</pre>
    </div>
  );
}
