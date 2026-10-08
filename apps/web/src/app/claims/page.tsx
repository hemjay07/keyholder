// File: apps/web/src/app/claims/page.tsx
// Proof of Control: a team states the control it promises, signs it with a key that controls the program, and the
// chain checks the promise every day. Published claims and today's verdicts; a checker for any signed claim.
import Link from 'next/link';
import { latestDay, claimChecks } from '@/lib/records';
import ClaimCheck from '@/components/ClaimCheck';
import s from '../stages/stages.module.css';
import c from './claims.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Claims', description: 'A team states its control; the chain checks it every day; a broken promise is news the same day.' };

const EXAMPLE = JSON.stringify({ version: 'keyholder-claim/v1', protocol: 'Your protocol', issuedAt: '2026-10-09', programs: [{ programId: 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD', upgrade: { kind: 'multisig', threshold: { min: 5 }, timelockS: { min: 86400 } } }], signer: '<a key on the controlling multisig>', signature: '<ed25519 signature>' }, null, 1);

export default async function ClaimsPage() {
  const day = await latestDay();
  const checks = day ? await claimChecks(day) : [];
  return (
    <main className={s.wrap}>
      <h1 className={s.h1}>Promises, checked by the chain.</h1>
      <p className={s.lede}>A team states the control it promises, signs it with a key that controls the program, and Keyholder checks the promise against the chain every day. A broken promise joins the <Link href="/changes?tab=record&kind=claim_broken">changes feed</Link> the same day.</p>
      <div className={s.layout}>
        <div>
          <section className={c.sec}>
            <h2 className={c.h2}>Published claims · {checks.length}</h2>
            {checks.length ? (
              <ul className={c.list}>{checks.map((k) => <li key={k.file}><b>{k.protocol}</b><span className={k.status === 'holds' ? c.holds : c.weak}>{k.status}</span><span>{k.day}</span></li>)}</ul>
            ) : <p className={c.empty}>No team has published a claim yet. The first one is checked from the next daily record.</p>}
          </section>
          <section className={c.sec}>
            <h2 className={c.h2}>Check a claim now</h2>
            <ClaimCheck example={EXAMPLE} />
          </section>
        </div>
        <aside className={s.side}>
          <h3>Publish yours</h3>
          <ol className={s.how}>
            <li><b>Write the promise.</b> For each program: the upgrade path (multisig threshold and minimum delay, governance, or immutable) and any admin keys.</li>
            <li><b>Sign it</b> with a key that controls the program: its upgrade key, or a member of the multisig that controls its upgrade. The secret key never leaves your machine.</li>
            <li><b>Check it</b> here or with <code>POST /api/v1/claims</code>.</li>
            <li><b>Publish it</b> with a pull request adding it to <code>data/claims/</code>. It is checked every day after that.</li>
          </ol>
          <pre className={s.pre}>{`npx tsx scripts/sign-claim.ts \\\n  claim.json ~/.config/solana/id.json \\\n  > signed.json`}</pre>
          <dl className={s.meta}>
            <div><dt>Format</dt><dd>keyholder-claim/v1</dd></div>
            <div><dt>Signature</dt><dd>ed25519 over sorted JSON</dd></div>
            <div><dt>API</dt><dd><Link href="/api/v1/claims">/api/v1/claims</Link></dd></div>
          </dl>
        </aside>
      </div>
    </main>
  );
}
