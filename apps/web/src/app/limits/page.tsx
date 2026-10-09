// File: apps/web/src/app/limits/page.tsx
// What Keyholder cannot see or stop, stated plainly (design/CONTENT-PLAN.md). Each limit names a real case where it
// mattered and what would close it.
import Link from 'next/link';
import s from '../stages/stages.module.css';
import l from './limits.module.css';

export const metadata = { title: 'Limits', description: 'What Keyholder cannot see or stop, and the real cases where that mattered.' };

const LIMITS: { title: string; body: string; caseText: string; caseHref?: string; close: string }[] = [
  { title: 'Admin keys compiled into the code', body: 'Some programs check a hard-coded key instead of reading one from an account. Keyholder reads accounts, so it does not see these keys or stage them.', caseText: 'Raydium AMM v4, December 2022: the stolen key was compiled in. KeyBench records this as a miss.', caseHref: '/keybench', close: 'Read the program binary for embedded keys; planned, not built.' },
  { title: 'Programs without a published IDL', body: 'Admin fields are found by decoding accounts with the program\'s interface. Without one, Keyholder cannot read them and holds the program at Stage 1 at most.', caseText: '315 of 583 programs have admin settings Keyholder could not read on the record of 2026-10-08.', caseHref: '/programs', close: 'Teams publish an IDL, or state their control in a signed claim.' },
  { title: 'Keys stolen off chain', body: 'A multisig with long delays still fails if enough of its keys are taken. Keyholder shows how many keys and how much delay stand in the way, not how well the keys are kept.', caseText: 'Drift, April 2026: the admin council\'s keys were used by the attacker; the delay was the defence that was missing.', caseHref: '/replay/drift', close: 'Delays give users time to leave; Keyholder flags when there is none.' },
  { title: 'Bugs in the program itself', body: 'Keyholder watches who can change a program, not whether the code is correct. A flaw that lets anyone take control is invisible until it is used.', caseText: 'A card contract, August 2026: the attacker granted itself admin through a flaw, 4 min 59 s before the first withdrawal.', caseHref: '/keybench', close: 'Audits and verified builds; Keyholder shows whether the deployed code matches a verified build.' },
  { title: 'Money it does not trace', body: 'Dollar figures count liquid tokens in program-owned vaults, priced daily. Positions inside other programs, illiquid tokens and off-chain collateral are not counted.', caseText: 'Every dollar figure on the site is a floor ("at least"), traced vault by vault.', close: 'Wider price coverage; the floors stay floors.' },
  { title: 'What happens between daily records', body: 'The record is built once a day. Upgrades and multisig changes are read live, and open votes every 30 minutes, but a stage can change between records.', caseText: 'Changes on chain appear on /changes as they land; stages move on the next record.', caseHref: '/changes', close: 'Recompute a program\'s stage when one of its control accounts changes.' },
];

export default function LimitsPage() {
  return (
    <main className={s.wrap}>
      <h1 className={s.h1}>What Keyholder cannot do.</h1>
      <p className={s.lede}>A control record is only useful if you know where it stops. These are the gaps, each with a real case and what would close it.</p>
      <ol className={l.list}>
        {LIMITS.map((x, i) => (
          <li key={x.title} style={{ ['--i' as string]: i }}>
            <span className={l.n}>{String(i + 1).padStart(2, '0')}</span>
            <div>
              <h2>{x.title}</h2>
              <p>{x.body}</p>
              <p className={l.case}>{x.caseHref ? <Link href={x.caseHref}>{x.caseText}</Link> : x.caseText}</p>
              <p className={l.close}><b>Would close it:</b> {x.close}</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
