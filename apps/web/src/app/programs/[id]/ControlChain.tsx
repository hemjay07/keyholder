// File: apps/web/src/app/programs/[id]/ControlChain.tsx
// Every control path of one program as a chain: program → path → controller → its keys. Nodes settle in one after
// another and each link draws left to right (CSS only, one easing; reduced motion shows the finished chain).
import { shortAddr } from '@/lib/program-names';
import type { ProgramRecordJson } from '@/lib/records';
import s from './program.module.css';

type Ms = { address: string; threshold: number; members: number; timelockS: number | null; version: string; memberKeys?: string[] } | null;
interface Path { label: string; stage: number | null; reason: string | null; controller: string | null; kind: string; ms: Ms; binding: boolean }

const delay = (h: number | null | undefined) => (h ? `${(h / 3600).toFixed(h % 3600 ? 1 : 0)} h delay` : 'no delay');
const stageClass = (n: number | null) => (n == null ? '' : n === 0 ? s.weak : n >= 2 ? s.holds : '');

function pathsOf(r: ProgramRecordJson): Path[] {
  const find = (p: string) => r.stage.paths.find((x) => x.path === p);
  const up = find('upgrade');
  const out: Path[] = [{ label: 'Upgrade', stage: up?.stage ?? null, reason: up?.reason ?? null, controller: r.upgrade.authority, kind: r.upgrade.kind, ms: r.upgrade.multisig, binding: r.stage.bindingPath === 'upgrade' }];
  for (const a of r.admin.programWide) {
    const key = `admin:${a.account}.${a.field}`, p = find(key);
    out.push({ label: `Admin · ${a.account}.${a.field}`, stage: p?.stage ?? null, reason: p?.reason ?? null, controller: a.key, kind: a.resolvedAs, ms: a.multisig, binding: r.stage.bindingPath === key });
  }
  return out;
}

export default function ControlChain({ record }: { record: ProgramRecordJson }) {
  const paths = pathsOf(record);
  return (
    <div className={s.chains} data-device="control-chain">
      {paths.map((p, row) => (
        <div key={p.label} className={`${s.chain} ${p.binding ? s.binding : ''}`} style={{ ['--row' as string]: row }}>
          <div className={s.node} style={{ ['--i' as string]: 0 }}><span className={s.k}>Program</span><code>{shortAddr(record.programId)}</code></div>
          <i className={s.link} style={{ ['--i' as string]: 1 }} />
          <div className={s.node} style={{ ['--i' as string]: 1 }}>
            <span className={s.k}>{p.label}{p.binding ? ' · sets the stage' : ''}</span>
            <b className={stageClass(p.stage)}>{p.stage == null ? 'not staged' : `Stage ${p.stage}`}</b>
          </div>
          <i className={s.link} style={{ ['--i' as string]: 2 }} />
          <div className={s.node} style={{ ['--i' as string]: 2 }}>
            <span className={s.k}>{p.ms ? `Squads ${p.ms.version} multisig` : p.kind.replace(/_/g, ' ')}</span>
            {p.ms ? <b>{p.ms.threshold} of {p.ms.members} · <span className={p.ms.timelockS ? s.holdsText : s.weakText}>{delay(p.ms.timelockS)}</span></b> : <code>{p.controller ? shortAddr(p.controller) : 'none'}</code>}
          </div>
          {p.ms?.memberKeys?.length ? (
            <>
              <div className={`${s.node} ${s.keys}`} style={{ ['--i' as string]: 3 }}>
                <span className={s.k}>Keys · {p.ms.memberKeys.length}, any {p.ms.threshold} can act</span>
                <div>{p.ms.memberKeys.map((k) => <a key={k} href={`/signers/${k}`} title={k}>{shortAddr(k)}</a>)}</div>
              </div>
            </>
          ) : null}
          {p.reason && <p className={s.reason} style={{ ['--i' as string]: 4 }}>{p.reason}</p>}
        </div>
      ))}
      {record.admin.status === 'unknown' && <p className={s.note}>Admin settings could not be read for this program, so it is held at Stage 1 at most until they are.</p>}
    </div>
  );
}
