// File: apps/web/src/app/signers/[key]/page.tsx
// One signer key (design/CHARTER.md /signers/[key]): how many multisigs it sits on, how much money is behind it,
// whether it can act alone anywhere, and the web from the key to every program it can help change.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { latestDay, signer, programRecord, type ProgramRecordJson } from '@/lib/records';
import { programName, shortAddr } from '@/lib/program-names';
import { formatUsd } from '@/components/stagemap/format';
import Web, { type WebMs, type WebProgram } from './Web';
import s from './signer.module.css';

export const dynamic = 'force-dynamic';

interface Entry { key: string; multisigs: WebMs[]; programs: { path: string; stage: number; usdFloor: number | null; programId: string }[] }

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return { title: `Key ${shortAddr(key)}`, description: 'Every Solana program this key can help change, and the money behind them.' };
}

/** Which of the key's multisigs controls this program on this path (from the program's record). */
function viaFor(r: ProgramRecordJson | null, path: string, mine: Set<string>): string | null {
  if (!r) return null;
  if (path === 'upgrade') return r.upgrade.multisig && mine.has(r.upgrade.multisig.address) ? r.upgrade.multisig.address : null;
  const a = r.admin.programWide.find((x) => `admin:${x.account}.${x.field}` === path);
  return a?.multisig && mine.has(a.multisig.address) ? a.multisig.address : null;
}

export default async function SignerPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const day = await latestDay();
  const entry = day ? ((await signer(key, day)) as Entry | null) : null;
  if (!day || !entry) notFound();
  const mine = new Set(entry.multisigs.map((m) => m.address));
  const ids = [...new Set(entry.programs.map((p) => p.programId))];
  const records = new Map(await Promise.all(ids.map(async (id) => [id, await programRecord(id, day)] as const)));
  const byProgram = new Map<string, WebProgram & { usd: number; paths: string[] }>();
  for (const p of entry.programs) {
    const e = byProgram.get(p.programId) ?? { programId: p.programId, stage: p.stage, vias: [], usd: p.usdFloor ?? 0, paths: [] };
    e.stage = Math.min(e.stage, p.stage); e.paths.push(p.path);
    const v = viaFor(records.get(p.programId) ?? null, p.path, mine);
    if (v && !e.vias.includes(v)) e.vias.push(v);
    byProgram.set(p.programId, e);
  }
  const programs = [...byProgram.values()].sort((a, b) => b.usd - a.usd);
  const usd = programs.reduce((t, p) => t + p.usd, 0);
  const alone = entry.multisigs.filter((m) => m.threshold === 1);
  return (
    <main className={s.wrap}>
      <p className={s.crumb}><Link href="/">Stage map</Link> / Signer</p>
      <h1 className={s.h1}>One key, {entry.multisigs.length} multisig{entry.multisigs.length === 1 ? '' : 's'}, <span className={s.weakText}>{usd ? formatUsd(usd) : 'no dollars traced'}</span> behind it</h1>
      <code className={s.addr}>{key}</code>
      {alone.length > 0 && <p className={s.alert}>This key can act alone on {alone.length === 1 ? 'one multisig' : `${alone.length} multisigs`}: {alone.map((m) => `${shortAddr(m.address)} (1 of ${m.members}, ${m.timelockS ? `${Math.round(m.timelockS / 3600)} h delay` : 'no delay'})`).join(' and ')} need{alone.length === 1 ? 's' : ''} only one signature.</p>}
      <section className={s.sec}><Web keyAddr={key} multisigs={entry.multisigs} programs={programs} /></section>
      <section className={s.sec}>
        <h2>Programs it can help change · {programs.length}</h2>
        <ul className={s.list}>{programs.map((p) => (
          <li key={p.programId}><Link href={`/programs/${p.programId}`}>{programName(p.programId)}</Link><span>{p.paths.map((x) => (x === 'upgrade' ? 'upgrade' : x.replace('admin:', 'admin · '))).join(', ')}</span><span>Stage {p.stage}{p.usd ? ` · ${formatUsd(p.usd)}` : ''}</span></li>
        ))}</ul>
      </section>
      <section className={s.sec}>
        <h2>Multisigs it sits on · {entry.multisigs.length}</h2>
        <ul className={s.list}>{entry.multisigs.map((m) => (
          <li key={m.address}><code>{shortAddr(m.address)}</code><span>{m.threshold} of {m.members}</span><span className={!m.timelockS ? s.weakText : m.timelockS >= 86400 ? s.holdsText : ''}>{m.timelockS ? `${Math.round(m.timelockS / 3600)} h delay` : 'no delay'}</span></li>
        ))}</ul>
      </section>
    </main>
  );
}
