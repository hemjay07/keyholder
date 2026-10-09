// File: apps/web/src/app/stories/open-votes/page.tsx
// "Approved 712 days ago" (design/CONTENT-PLAN.md #3): the open votes as governance debt, not a hack. One timeline: each
// control-relevant open vote is a bar from the day it reached its current status to today; approved bars can run now.
import Link from 'next/link';
import { pendingActions } from '@/lib/records';
import { programName, shortAddr } from '@/lib/program-names';
import s from './story.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Approved, and still waiting', description: 'Open multisig votes on Solana programs that were approved long ago and can still run.' };

type Vote = Awaited<ReturnType<typeof pendingActions>>[number];
const DAY = 86400000;
const CONTROL = new Set(['program_upgrade', 'set_upgrade_authority', 'close_program', 'change_threshold', 'remove_member', 'add_member', 'set_timelock']);

function what(v: Vote): string {
  const t = new Set((Array.isArray(v.actions) ? (v.actions as { type?: string }[]) : []).map((a) => a.type ?? 'call'));
  if (t.has('program_upgrade')) return 'replace program code';
  if (t.has('set_upgrade_authority')) return 'hand over the upgrade key';
  if (t.has('close_program')) return 'close a program';
  if (t.has('change_threshold') || t.has('remove_member') || t.has('add_member')) return 'change who signs';
  if (t.has('set_timelock')) return 'change the delay';
  if (t.has('sol_transfer') || t.has('token_transfer')) return 'move funds';
  return 'call a program';
}

export default async function OpenVotesStory() {
  const votes = (await pendingActions({ relevantOnly: true, limit: 500 })).filter((v) => v.status_at);
  const now = Date.now();
  const age = (v: Vote) => Math.floor((now - v.status_at!.getTime()) / DAY);
  const approved = votes.filter((v) => v.status === 'Approved').sort((a, b) => age(b) - age(a));
  const active = votes.filter((v) => v.status !== 'Approved');
  const oldest = approved[0];
  const max = Math.max(1, ...votes.map(age));
  const control = approved.filter((v) => (Array.isArray(v.actions) ? (v.actions as { type?: string }[]) : []).some((a) => CONTROL.has(a.type ?? '')));
  const ids = (v: Vote) => [...new Set((Array.isArray(v.controls) ? (v.controls as { programId: string }[]) : []).map((c) => c.programId))];
  const ticks = [0, 180, 365, 540, 720].filter((d) => d <= max + 30);
  return (
    <main className={s.wrap}>
      <p className={s.kicker}>Story · from the open-vote record</p>
      <h1 className={s.h1}>Approved <span className={s.num}>{oldest ? age(oldest) : 0} days</span> ago, and it can still run.</h1>
      <p className={s.lede}>A multisig vote that reaches its threshold does not have to execute. It waits, approved, until any signer sends it. On Solana today {approved.length} approved votes on multisigs that control covered programs are waiting like this; {control.length} of them would change program code or who controls it. None is an attack. Each is a decision that can still be carried out, by people who agreed to it long ago.</p>

      <section className={s.chart} data-device="vote-timeline" aria-label="How long each open vote has waited">
        <div className={s.axis}>{ticks.map((d) => <span key={d} style={{ left: `${(d / max) * 100}%` }}>{d === 0 ? 'today' : `${d} days`}</span>)}</div>
        <ol className={s.bars}>
          {[...approved, ...active.sort((a, b) => age(b) - age(a))].map((v, i) => (
            <li key={v.address} data-film={i === 0 ? 'oldest' : undefined} style={{ ['--w' as string]: Math.max(0.006, age(v) / max), ['--i' as string]: i }} className={v.status === 'Approved' ? s.ok : s.wait}>
              <span className={s.label}>{ids(v).slice(0, 2).map(programName).join(', ')} · {what(v)} · {age(v)} d</span>
              <span className={s.track}><i /></span>
            </li>
          ))}
        </ol>
        <p className={s.legend}><i className={s.ok} /> approved, can run now <i className={s.wait} /> still collecting signatures · bar = days since it reached that status</p>
      </section>

      {oldest && (
        <section className={s.focus}>
          <h2>The oldest one</h2>
          <p>Transaction #{oldest.tx_index} on multisig <code>{shortAddr(oldest.multisig)}</code> reached {oldest.approvals} of {oldest.threshold ?? '?'} approvals {age(oldest)} days ago. It would {what(oldest)} on {ids(oldest).map(programName).join(', ')}. There is {oldest.timelock_s ? `a ${Math.round(oldest.timelock_s / 3600)} h delay` : 'no delay'} between sending it and its effect.</p>
          {oldest.explanation && <blockquote>{oldest.explanation}</blockquote>}
          <p className={s.src}>Read from chain every 30 minutes. Transaction <code>{shortAddr(oldest.address)}</code>.</p>
        </section>
      )}

      <section className={s.focus}>
        <h2>Why it matters, and what teams can do</h2>
        <p>An approved vote is a loaded instruction. Signers change, keys get lost or taken, and the intent behind an old approval fades, but the approval does not. The fix is ordinary housekeeping: execute what was meant, and cancel what was not, so the queue only holds decisions someone still stands behind.</p>
        <p><Link href="/pending">Every open vote, with what it would do →</Link></p>
      </section>
    </main>
  );
}
