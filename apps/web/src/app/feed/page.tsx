// /feed: every control change on the tracked Solana programs, newest first.
// Upgrades, upgrade-authority moves and multisig config changes, decoded from
// chain by the worker; each row carries its transaction.
import Link from "next/link";
import { fetchControlChanges, countControlChangesSince, fetchProtocols, dailyControlChanges } from "@/lib/api-client";
import Seismograph, { type SeismoDay } from "@/components/Seismograph";

export const dynamic = "force-dynamic";

const KIND_WORDS: Record<string, string> = {
  upgrade: "Program upgraded",
  set_authority: "Upgrade authority changed",
  config_transaction_execute: "Multisig settings changed",
};

function shortAddr(a: string): string {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

function dayOf(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function detail(kind: string, payload: unknown): string | null {
  const p = (payload ?? {}) as Record<string, unknown>;
  if (kind === "upgrade" && typeof p.upgradeAuthority === "string") return `authority ${shortAddr(p.upgradeAuthority)}`;
  if (kind === "set_authority") {
    const to = p.newAuthority ?? p.newUpgradeAuthority;
    if (to === null) return "made immutable";
    if (typeof to === "string") return `to ${shortAddr(to)}`;
  }
  return null;
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ before?: string; protocol?: string }> }) {
  const { before, protocol } = await searchParams;
  let data: Awaited<ReturnType<typeof fetchControlChanges>> | null = null;
  let recent: Awaited<ReturnType<typeof countControlChangesSince>> = [];
  let daily: Awaited<ReturnType<typeof dailyControlChanges>> = [];
  const seismoTo = new Date().toISOString().slice(0, 10);
  const seismoFromDate = new Date(Date.now() - 179 * 86400000);
  const seismoFrom = seismoFromDate.toISOString().slice(0, 10);
  let names = new Map<string, string>();
  let weakIds = new Set<string>();
  try {
    const since = new Date(Date.now() - 30 * 86400000);
    const [changes, counts, protocols, perDay] = await Promise.all([
      fetchControlChanges({ before, protocol }),
      countControlChangesSince(since),
      fetchProtocols(),
      dailyControlChanges(new Date(seismoFrom + "T00:00:00Z")),
    ]);
    daily = perDay;
    data = changes;
    recent = counts;
    names = new Map(protocols.map((p) => [p.id, p.name]));
    weakIds = new Set(
      protocols.filter((p) => p.controlFacts?.timelock?.kind === "none" || p.controlFacts?.timelock?.kind === "no_timelock_feature").map((p) => p.id)
    );
  } catch (err) {
    console.error("feed read failed:", err instanceof Error ? err.message.slice(0, 300) : "unknown");
    data = null;
  }

  const total30 = recent.reduce((n, r) => n + r.n, 0);
  const weak30 = recent.filter((r) => r.protocolId && weakIds.has(r.protocolId)).reduce((n, r) => n + r.n, 0);

  const seismoMap = new Map<string, SeismoDay>();
  for (const r of daily) {
    const d = seismoMap.get(r.day) ?? { day: r.day, weak: 0, other: 0 };
    if (r.protocolId && weakIds.has(r.protocolId)) d.weak += r.n;
    else d.other += r.n;
    seismoMap.set(r.day, d);
  }

  const groups: Array<{ day: string; rows: NonNullable<typeof data>["changes"] }> = [];
  for (const c of data?.changes ?? []) {
    const day = dayOf(c.blockTime);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(c);
    else groups.push({ day, rows: [c] });
  }

  return (
    <main className="feed-page">
      <Link className="back-link" href="/">&larr; Keyholder</Link>
      <section className="feed-head">
        <p className="kicker">Keyholder · Feed{protocol ? ` · ${names.get(protocol) ?? protocol}` : ""}</p>
        <h1>Every control change on Solana, as it lands.</h1>
        {data && (
          <p className="feed-finding">
            <b>{total30}</b> control changes to the {names.size} tracked protocols in the last 30 days
            {weak30 > 0 && <>; <b className="weak">{weak30}</b> of them by protocols with no timelock, live the moment they signed</>}.
          </p>
        )}
      </section>

      {data && <section className="seismo-section"><Seismograph days={[...seismoMap.values()]} from={seismoFrom} to={seismoTo} /></section>}

      {!data ? (
        <p className="feed-error">The feed could not be read right now. Nothing is shown in its place.</p>
      ) : groups.length === 0 ? (
        <p className="feed-error">No control changes recorded{protocol ? " for this protocol" : ""} yet.</p>
      ) : (
        <section className="feed-list">
          {groups.map((g) => (
            <div key={g.day} className="feed-day">
              <h2 className="mono">{g.day}</h2>
              <ol>
                {g.rows.map((c) => {
                  const weak = c.protocolId ? weakIds.has(c.protocolId) : false;
                  const d = detail(c.kind, c.payload);
                  return (
                    <li key={c.uid} className={`feed-row ${weak ? "weak" : ""}`}>
                      <span className="feed-time mono">{c.blockTime.slice(11, 16)} UTC</span>
                      <span className="feed-what">
                        <span className="feed-main">
                          <Link href={`/protocols/${c.protocolId}`} className="feed-proto">{names.get(c.protocolId ?? "") ?? c.protocolId}</Link>
                          {" · "}{KIND_WORDS[c.kind] ?? c.kind}
                        </span>
                        {d && <span className="feed-detail mono">{d}</span>}
                        {weak && <span className="feed-weak mono">no timelock</span>}
                      </span>
                      <a className="feed-sig mono" href={`https://solscan.io/tx/${c.signature}`} target="_blank" rel="noreferrer" title={c.signature}>
                        {c.signature.slice(0, 6)}…{c.signature.slice(-6)}
                      </a>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          {data.before && (
            <Link className="feed-more mono" href={`/feed?before=${encodeURIComponent(data.before)}${protocol ? `&protocol=${protocol}` : ""}`}>
              Older changes &rarr;
            </Link>
          )}
        </section>
      )}
    </main>
  );
}
