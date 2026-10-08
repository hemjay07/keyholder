// File: apps/web/src/app/policy/page.tsx
// Build (nav: "Build"): any program can refuse money where control is weak, with one line, require_stage.
// The simulator runs the on-chain rule (upgrade-path stage, minimum delay) over today's record; below it, the check
// refusing a real deposit on devnet, and Keyholder's own upgrade going through its own 2-of-3, 48 h rule.
import Link from 'next/link';
import { latestDay, registry } from '@/lib/records';
import { programName } from '@/lib/program-names';
import { STEPS, OWN_CONTROL, PROGRAMS, explorerAddr, explorerTx } from '@/lib/proof';
import BuildSim, { type SimRow } from '@/components/BuildSim';
import own from '../../../../../data/own-upgrade.json';
import s from './build.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Build', description: 'Refuse money where control is weak, with one line: require_stage.' };

const short = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;
const utc = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

export default async function BuildPage() {
  const day = await latestDay();
  const rows: SimRow[] = day
    ? (await registry(day)).filter((r) => !r.modifiers.includes('closed')).map((r) => ({ id: r.programId, name: programName(r.programId), stage: r.upgradeStage, timelockS: r.timelockS, usd: r.usdFloor ?? 0 }))
    : [];
  const up = own.upgrade;
  const ready = Date.now() >= Date.parse(up.executableAfter);
  return (
    <main className={s.wrap}>
      <p className={s.kicker}>Build</p>
      <h1 className={s.h1}>Refuse money where control is weak, with one line.</h1>
      <p className={s.lede}>Before your program moves user funds into another program, call <code>require_stage</code>. Keyholder reads that program&rsquo;s upgrade authority on chain, works out its stage and delay, and fails the transaction if they are below your policy. Try a policy against today&rsquo;s {rows.length} programs.</p>

      <section className={s.sec}><BuildSim rows={rows} /></section>
      <p className={s.fine}>On chain, require_stage reads the upgrade path (Squads v4/v3 and coral multisigs, immutable programs). The record&rsquo;s stage on <Link href="/stages">/stages</Link> also counts admin keys, so it can be lower.</p>

      <section className={s.sec}>
        <h2 className={s.h2}>It already refused a deposit, on devnet</h2>
        <ol className={s.steps}>
          {STEPS.map((st, i) => (
            <li key={st.signature} className={st.outcome === 'pass' ? s.pass : st.outcome === 'refused' ? s.refused : s.change} style={{ ['--i' as string]: i }}>
              <span className={s.when}>{st.time.slice(11, 19)} UTC · slot {st.slot.toLocaleString('en-US')}</span>
              <b>{st.title}</b>
              <p>{st.detail}</p>
              {st.facts && <span className={s.facts}>{st.facts.threshold} of {st.facts.members} · {st.facts.timelockS ? `${st.facts.timelockS} s` : 'no'} timelock</span>}
              <a href={explorerTx(st.signature)} target="_blank" rel="noreferrer">{short(st.signature)} ↗</a>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${s.sec} ${s.two}`}>
        <div>
          <h2 className={s.h2}>Keyholder follows its own rule</h2>
          <p className={s.body}>Keyholder&rsquo;s program can only change through a {OWN_CONTROL.threshold}-of-{OWN_CONTROL.members} Squads multisig, and every change waits {OWN_CONTROL.timeLockHours} hours in public first: Stage 2. Its first upgrade is in that window now.</p>
          <ol className={s.timeline}>
            <li className={s.done}><b>Proposed and approved, 2 of 3</b><span>{utc(up.approvedAt)}</span><a href={explorerTx(up.proposed)} target="_blank" rel="noreferrer">{short(up.proposed)} ↗</a></li>
            <li className={ready ? s.done : s.wait}><b>{ready ? 'Delay passed' : 'Waiting out the 48 h delay'}</b><span>executable after {utc(up.executableAfter)}</span></li>
            <li className={s.next}><b>Executed, upgrade lands</b><span>{ready ? 'ready to execute' : 'not before the delay ends'}</span></li>
          </ol>
        </div>
        <dl className={s.meta}>
          <div><dt>Program</dt><dd><a href={explorerAddr(PROGRAMS.keyholder.id)} target="_blank" rel="noreferrer">3FX5…8R8F</a></dd></div>
          <div><dt>Multisig</dt><dd><a href={explorerAddr(OWN_CONTROL.multisig)} target="_blank" rel="noreferrer">{short(OWN_CONTROL.multisig)}</a> · Squads v4</dd></div>
          <div><dt>Rule</dt><dd>{OWN_CONTROL.threshold} of {OWN_CONTROL.members} · {OWN_CONTROL.timeLockHours} h</dd></div>
          <div><dt>Cluster</dt><dd>devnet; mainnet under the same rule</dd></div>
          <div><dt>API</dt><dd><Link href="/api/v1/stages">/api/v1/stages</Link> · <Link href="/api/v1/records">/api/v1/records</Link></dd></div>
        </dl>
      </section>
    </main>
  );
}
