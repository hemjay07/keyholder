// File: apps/web/src/app/changes/page.tsx
// Every change to who controls Solana money (design/CHARTER.md /changes), two sources in tabs:
//   chain   upgrades, upgrade-authority moves and multisig config changes, decoded from mainnet by the worker
//   record  the daily Control Record diffs: open votes appearing, programs closed, signers changed, stages moved
// Sidebar: what kind of change, how many, with filters. Paged in the URL (?tab, ?kind, ?page, ?per).
import Link from 'next/link';
import { chainChangesPage, recordChangesPage } from '@/lib/records';
import { fetchProtocols, dailyControlChanges } from '@/lib/api-client';
import Seismograph, { type SeismoDay } from '@/components/Seismograph';
import { programName, shortAddr } from '@/lib/program-names';
import Pager, { paginate, PER_OPTIONS } from '@/components/Pager';
import s from './changes.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Changes', description: 'Every change to who controls money on Solana, as it lands, with its transaction.' };

type Q = { tab?: string; kind?: string; page?: string; per?: string };
const CHAIN_KIND: Record<string, string> = { upgrade: 'Program upgraded', set_authority: 'Upgrade authority moved', config_transaction_execute: 'Multisig settings changed' };
const RECORD_KIND: Record<string, string> = { pending_control_action: 'Open vote appeared', program_closed: 'Program closed', members_changed: 'Signers changed', stage_changed: 'Stage changed', timelock_changed: 'Delay changed', threshold_changed: 'Threshold changed', authority_changed: 'Authority changed', multisig_replaced: 'Multisig replaced', admin_changed: 'Admin changed', claim_broken: 'Claim broken' };
const WEAK = new Set(['set_authority', 'program_closed', 'claim_broken', 'pending_control_action']);

const when = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '');
function chainDetail(kind: string, payload: unknown): string | null {
  const p = (payload ?? {}) as Record<string, unknown>;
  if (kind === 'upgrade' && typeof p.upgradeAuthority === 'string') return `by ${shortAddr(p.upgradeAuthority)}`;
  const to = p.newAuthority ?? p.newUpgradeAuthority;
  if (kind === 'set_authority' && typeof to === 'string') return `to ${shortAddr(to)}`;
  return null;
}

export default async function ChangesPage({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const tab = q.tab === 'record' ? 'record' : 'chain';
  const per = PER_OPTIONS.find((n) => String(n) === q.per) ?? 50;
  const page = Math.max(1, Number.parseInt(q.page ?? '1', 10) || 1);
  const kinds = tab === 'chain' ? CHAIN_KIND : RECORD_KIND;
  const kind = q.kind && kinds[q.kind] ? q.kind : undefined;
  const [chain, record, protocols] = await Promise.all([
    chainChangesPage({ offset: tab === 'chain' ? (page - 1) * per : 0, limit: tab === 'chain' ? per : 1, kind: tab === 'chain' ? kind : undefined }),
    recordChangesPage({ offset: tab === 'record' ? (page - 1) * per : 0, limit: tab === 'record' ? per : 1, kind: tab === 'record' ? kind : undefined }),
    fetchProtocols().catch(() => []),
  ]);
  // Activity strip (the page's device): one tick per day for the last 180 days, orange where the protocol has no timelock.
  const to = new Date().toISOString().slice(0, 10), from = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const daily = tab === 'chain' ? await dailyControlChanges(new Date(`${from}T00:00:00Z`)).catch(() => []) : [];
  const pname = new Map(protocols.map((p) => [p.id, p.name]));
  const noLock = new Set(protocols.filter((p) => p.controlFacts?.timelock?.kind === 'none' || p.controlFacts?.timelock?.kind === 'no_timelock_feature').map((p) => p.id));
  const seismo = new Map<string, SeismoDay>();
  for (const r of daily) { const d = seismo.get(r.day) ?? { day: r.day, weak: 0, other: 0 }; if (r.protocolId && noLock.has(r.protocolId)) d.weak += r.n; else d.other += r.n; seismo.set(r.day, d); }
  const cur = tab === 'chain' ? chain : record;
  const pg = paginate(cur.total, String(page), String(per));
  const query = { tab: tab === 'record' ? 'record' : undefined, kind, per: q.per };
  const totalChain = chain.byKind.reduce((t, k) => t + k.n, 0), totalRecord = record.byKind.reduce((t, k) => t + k.n, 0);
  let lastDay = '';
  return (
    <main className={s.wrap}>
      <h1 className={s.h1}>Every change to who controls the money, as it lands</h1>
      <p className={s.lede}>Upgrades and authority moves read from mainnet, and the daily Control Record diffs. Each row carries its transaction or record day.</p>
      <div className={s.layout}>
        <aside className={s.side}>
          <nav className={s.tabs} aria-label="Source">
            <Link className={tab === 'chain' ? s.on : ''} href="/changes"><b>{totalChain}</b>On chain<small>upgrades, authority, multisig settings</small></Link>
            <Link className={tab === 'record' ? s.on : ''} href="/changes?tab=record"><b>{totalRecord}</b>In the record<small>daily diffs since 2026-10-02</small></Link>
          </nav>
          <ul className={s.kinds}>
            <li><Link className={!kind ? s.on : ''} href={tab === 'record' ? '/changes?tab=record' : '/changes'}>All kinds<span>{tab === 'chain' ? totalChain : totalRecord}</span></Link></li>
            {(tab === 'chain' ? chain.byKind : record.byKind).sort((a, b) => b.n - a.n).map((k) => (
              <li key={k.kind}><Link className={kind === k.kind ? s.on : ''} href={`/changes?${new URLSearchParams({ ...(tab === 'record' ? { tab: 'record' } : {}), kind: k.kind })}`}><i className={WEAK.has(k.kind) ? s.dotWeak : s.dot} />{kinds[k.kind] ?? k.kind.replace(/_/g, ' ')}<span>{k.n}</span></Link></li>
            ))}
          </ul>
          <p className={s.note}>Same data: <Link href="/api/v1/changes">/api/v1/changes</Link></p>
        </aside>
        <section className={s.main}>
          {tab === 'chain' && seismo.size > 0 && (
            <div className={s.strip} data-device="change-seismograph">
              <Seismograph days={[...seismo.values()]} from={from} to={to} href={(d) => `/changes?kind=upgrade#d-${d}`} />
            </div>
          )}
          <Pager base="/changes" query={query} noun="changes" {...pg} />
          <ol className={s.list}>
            {tab === 'chain' ? chain.rows.map((r) => {
              const day = r.blockTime ? r.blockTime.toISOString().slice(0, 10) : '';
              const head = day !== lastDay ? (lastDay = day) : null;
              return (
                <li key={r.uid}>
                  {head && <h3 className={s.day}>{head}</h3>}
                  <div className={s.row}>
                    <time>{when(r.blockTime).slice(11)}</time>
                    <span className={s.what}><i className={WEAK.has(r.kind) ? s.dotWeak : s.dot} />{CHAIN_KIND[r.kind] ?? r.kind}</span>
                    <span className={s.who}>{r.programId ? <Link href={`/programs/${r.programId}`}>{pname.get(r.protocolId ?? '') ?? programName(r.programId)}</Link> : pname.get(r.protocolId ?? '')}<small>{chainDetail(r.kind, r.payload)}</small>{r.protocolId && noLock.has(r.protocolId) && <em className={s.tag}>no timelock</em>}</span>
                    {r.signature && <a className={s.tx} href={`https://solscan.io/tx/${r.signature}`} target="_blank" rel="noreferrer">{shortAddr(r.signature)}</a>}
                  </div>
                </li>
              );
            }) : record.rows.map((r) => {
              const head = r.day !== lastDay ? (lastDay = r.day) : null;
              return (
                <li key={r.id}>
                  {head && <h3 className={s.day}>{head}</h3>}
                  <div className={s.row}>
                    <time>record</time>
                    <span className={s.what}><i className={WEAK.has(r.kind) ? s.dotWeak : s.dot} />{RECORD_KIND[r.kind] ?? r.kind.replace(/_/g, ' ')}</span>
                    <span className={s.who}><Link href={`/programs/${r.program_id}`}>{programName(r.program_id)}</Link><small>{r.path === 'upgrade' ? 'upgrade path' : r.path.replace('admin:', 'admin · ')}</small></span>
                    <span className={s.tx}>{r.day}</span>
                  </div>
                </li>
              );
            })}
          </ol>
          {!cur.rows.length && <p className={s.empty}>No change of this kind yet.</p>}
          <Pager base="/changes" query={query} noun="changes" {...pg} />
        </section>
      </div>
    </main>
  );
}
