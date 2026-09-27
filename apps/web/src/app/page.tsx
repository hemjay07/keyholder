// File: apps/web/src/app/page.tsx
// The first fold (design/CHARTER.md, plan/CREATIVE.md v3 §5). Every fact below is read
// straight from the DB via apps/web/src/lib/api-client — a failed read shows nothing and
// says so, never a placeholder number.
import Link from "next/link";
import { fetchControlChanges, fetchProtocols, type ProtocolSummary } from "@/lib/api-client";
import { timelockLabel, controlLabel } from "@/lib/console-data";

export const dynamic = "force-dynamic";

function isRealProtocol(p: ProtocolSummary) {
  // "Drift (test)" is a QA fixture in the shared DB, not one of the 15 tracked protocols
  // the product reports on (design/CHARTER.md, design/TEN.md #6).
  return !p.id.includes("test");
}

function weaknessRank(p: ProtocolSummary): number {
  const tl = p.controlFacts?.timelock;
  if (!p.controlFacts || p.controlFacts.threshold == null) return 3; // unresolved: unknown, not "weak"
  if (tl && (tl.kind === "none" || tl.kind === "no_timelock_feature")) return 0; // weakest: no timelock at all
  return 1; // has a timelock
}

function keyRatio(p: ProtocolSummary): number {
  if (!p.controlFacts?.threshold || !p.controlFacts?.members) return 1;
  return p.controlFacts.threshold / p.controlFacts.members;
}

// The replay strip's axis: 24 March to 3 April 2026, linear.
const A0 = Date.parse("2026-03-24T00:00:00Z"), A1 = Date.parse("2026-04-03T00:00:00Z");
const pos = (iso: string) => ((Date.parse(iso) - A0) / (A1 - A0)) * 100;

export default async function HomePage() {
  let protocols: ProtocolSummary[] = [];
  let readError: string | null = null;

  try {
    protocols = (await fetchProtocols()).filter(isRealProtocol);
  } catch (err) {
    console.error("HomePage: fetchProtocols failed", err);
    readError = "protocols";
  }


  const sorted = [...protocols].sort((a, b) => {
    const rankDiff = weaknessRank(a) - weaknessRank(b);
    if (rankDiff !== 0) return rankDiff;
    return keyRatio(a) - keyRatio(b);
  });

  const liveSlot = protocols.reduce<number | null>((max, p) => {
    const s = p.controlFacts?.asOfSlot;
    if (s == null) return max;
    return max == null || s > max ? s : max;
  }, null);

  let latest: Awaited<ReturnType<typeof fetchControlChanges>>["changes"] = [];
  try {
    latest = (await fetchControlChanges({ limit: 5 })).changes;
  } catch (err) {
    console.error("HomePage: fetchControlChanges failed", err instanceof Error ? err.message.slice(0, 200) : "unknown");
  }

  const resolved = protocols.filter((p) => p.controlFacts?.threshold != null);
  const noTimelock = resolved.filter((p) => {
    const tl = p.controlFacts?.timelock;
    return tl && (tl.kind === "none" || tl.kind === "no_timelock_feature");
  });

  const protocolById = new Map(protocols.map((p) => [p.id, p]));

  return (
    <main>
      {readError ? (
        <p className="strip-error mono">Live protocol read failed — status strip and control map are unavailable right now.</p>
      ) : (
        <header className="strip mono">
          <span className="strip-slot">SLOT <b>{liveSlot != null ? liveSlot.toLocaleString("en-US") : "unavailable"}</b></span>
          <span><b>{protocols.length}</b> PROTOCOLS</span>
          <span className="weak"><b>{noTimelock.length}</b> OF {resolved.length} WITH NO TIMELOCK</span>
        </header>
      )}

      <section className="home-fold">
        <div className="home-lede">
          <h1>Drift needed two keys to lose $285M.</h1>
          <p className="lede-tape mono">Count the keys.</p>
          <p className="lede">
            Keyholder shows who can move the money in every Solana protocol, rings when that control weakens, and lets any program
            refuse to deposit where it just did.
          </p>
          <div className="cta">
            <Link className="primary" href="/wallet">Check your wallet</Link>
            <a href="#protocols">All {protocols.length} protocols</a>
          </div>
        </div>
        <div className="home-weakest" aria-label="Weakest control today">
          <p className="hw-label mono">Weakest control on record</p>
          {sorted.filter((p) => p.controlFacts?.threshold != null).slice(0, 5).map((p) => {
            const f = p.controlFacts!;
            const noTl = f.timelock?.kind === "none" || f.timelock?.kind === "no_timelock_feature";
            return (
              <Link key={p.id} href={`/protocols/${p.id}`} className={`hw-row${noTl ? " weak" : ""}`}>
                <span className="hw-name">{p.name}</span>
                <span className="hw-keys" aria-label={`${f.threshold} of ${f.members} keys`}>
                  {Array.from({ length: Math.min(f.members ?? 0, 15) }, (_, i) => <i key={i} className={i < (f.threshold ?? 0) ? "on" : ""} />)}
                </span>
                <span className="hw-meta mono">{f.threshold} of {f.members} · {noTl ? "no timelock" : timelockLabel(f)}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <Link href="/replay/drift" className="home-replay" aria-label="Watch the Drift replay">
        <span className="hr-text">
          <b className="mono">5.6 days of warning</b>
          <span>Keyholder&apos;s first alert on Drift fired on 25 March. The money left on 31 March. Watch it step by step &rarr;</span>
        </span>
        <span className="hr-lanes" aria-hidden="true">
          <span className="hr-band" style={{ left: `${pos("2026-03-25T16:58:31Z")}%`, width: `${pos("2026-03-31T07:16:19Z") - pos("2026-03-25T16:58:31Z")}%` }} />
          <span className="hr-lane"><em>Alerts</em><i className="hr-tick a" style={{ left: `${pos("2026-03-25T16:58:31Z")}%` }} /></span>
          <span className="hr-lane"><em>Money out</em><i className="hr-tick m" style={{ left: `${pos("2026-03-31T07:16:19Z")}%` }} /><i className="hr-tick m" style={{ left: `${pos("2026-04-01T20:03:00Z")}%` }} /></span>
          <span className="hr-axis mono"><span style={{ left: 0 }}>24 Mar</span><span style={{ left: `${pos("2026-03-31T00:00:00Z")}%` }}>31 Mar</span></span>
        </span>
      </Link>

      <section className="protocols-section" id="protocols">
        {resolved.length > 0 && (
          <p className="finding">
            <b>{noTimelock.length} of {resolved.length}</b> resolved protocols have no timelock at all: a
            multisig can move funds the moment enough keys sign.
          </p>
        )}
        <table className="ptable">
          <caption>All {protocols.length} tracked protocols, sorted weakest control first</caption>
          <thead>
            <tr>
              <th>Protocol</th>
              <th>Keys</th>
              <th>Timelock</th>
              <th>Verified</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const facts = p.controlFacts;
              const unresolved = !facts || facts.threshold == null;
              const tlKind = facts?.timelock?.kind;
              const noTl = tlKind === "none" || tlKind === "no_timelock_feature";
              return (
                <tr key={p.id} className={noTl ? "pt-weak" : undefined}>
                  <td><Link className="pt-name" href={`/protocols/${p.id}`}>{p.name}</Link></td>
                  <td>{controlLabel(facts ?? null)}</td>
                  <td className={noTl ? "pt-timelock none" : "pt-timelock"}>
                    {unresolved ? "—" : timelockLabel(facts)}
                  </td>
                  <td>
                    <span className={`lamp ${facts?.verifiedStatus === "verified" ? "on" : facts?.verifiedStatus === "drifted" ? "drift" : "off"}`} />
                    {facts?.verifiedStatus === "verified" ? "verified" : facts?.verifiedStatus === "drifted" ? "drifted" : facts?.verifiedStatus === "unverified" ? "never registered" : "—"}
                  </td>
                  <td>
                    {p.evidenceSignature ? (
                      <a className="pt-evlink" href={`https://solscan.io/tx/${p.evidenceSignature}`} target="_blank" rel="noreferrer">
                        transaction
                      </a>
                    ) : p.evidenceNote ? (
                      <span className="pt-evlink" title={p.evidenceNote}>unresolved</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="rails single">
        <div className="rail">
          <h2>Latest changes</h2>
          {latest.length === 0 ? (
            <p className="rail-empty">No control changes recorded yet for these protocols.</p>
          ) : (
            <>
              {latest.map((c) => (
                <div className="row" key={c.uid}>
                  <span className="who">{protocolById.get(c.protocolId ?? "")?.name ?? c.protocolId} · {c.kind === "upgrade" ? "program upgraded" : c.kind === "set_authority" ? "upgrade authority changed" : "multisig settings changed"}</span>
                  <span className="meta mono">
                    {c.blockTime.slice(0, 10)} ·{" "}
                    <a className="evlink" href={`https://solscan.io/tx/${c.signature}`} target="_blank" rel="noreferrer">{c.signature.slice(0, 6)}…</a>
                  </span>
                </div>
              ))}
              <Link className="rail-more mono" href="/feed">Every change &rarr;</Link>
            </>
          )}
        </div>
      </div>



      <footer className="mono">KEYHOLDER · every figure carries its slot, transaction or reconstructed label</footer>
    </main>
  );
}
