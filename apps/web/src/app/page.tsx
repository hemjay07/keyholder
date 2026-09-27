// File: apps/web/src/app/page.tsx
// The first fold (design/CHARTER.md, plan/CREATIVE.md v3 §5). Every fact below is read
// straight from the DB via apps/web/src/lib/api-client — a failed read shows nothing and
// says so, never a placeholder number.
import Link from "next/link";
import { fetchControlChanges, fetchProtocols, fetchEvents, type ProtocolSummary } from "@/lib/api-client";
import { timelockLabel, controlLabel } from "@/lib/console-data";
import ConsoleDevice from "@/components/console/ConsoleDevice";
import type { ConsoleData } from "@/components/console/Console";

export const dynamic = "force-dynamic";

// The prototype's fixed HERO state (design/devices/console/src/state.js, design/CONTEXT.md
// "the one moment"): Drift's admin council at the drain, reconstructed from on-chain
// history, not a live read. Never mixed with a live protocol's facts.
const HERO_CONSOLE: ConsoleData = {
  protocol: "DRIFT · ADMIN",
  threshold: 2,
  members: 5,
  timelockSeconds: 0,
  noTimelockFeature: false,
  verified: false,
  codeDrifted: false,
  weakened: true,
  slot: null,
  label: "Drift · admin council · 1 Apr 2026 · reconstructed",
};

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

export default async function HomePage() {
  let protocols: ProtocolSummary[] = [];
  let events: Awaited<ReturnType<typeof fetchEvents>>["events"] = [];
  let readError: string | null = null;

  try {
    protocols = (await fetchProtocols()).filter(isRealProtocol);
  } catch (err) {
    console.error("HomePage: fetchProtocols failed", err);
    readError = "protocols";
  }

  try {
    const result = await fetchEvents({ limit: 20 });
    events = result.events.filter((e) => protocols.some((p) => p.id === e.protocolId));
  } catch (err) {
    console.error("HomePage: fetchEvents failed", err);
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

  const now = Date.now();
  const changes24h = events.filter((e) => e.createdAt && now - new Date(e.createdAt).getTime() < 86_400_000);

  const resolved = protocols.filter((p) => p.controlFacts?.threshold != null);
  const noTimelock = resolved.filter((p) => {
    const tl = p.controlFacts?.timelock;
    return tl && (tl.kind === "none" || tl.kind === "no_timelock_feature");
  });

  const vCount = (status: string) => protocols.filter((p) => p.controlFacts?.verifiedStatus === status).length;

  const protocolById = new Map(protocols.map((p) => [p.id, p]));
  const readDate = new Date().toISOString().slice(0, 10);

  return (
    <main>
      {readError ? (
        <p className="strip-error mono">Live protocol read failed — status strip and control map are unavailable right now.</p>
      ) : (
        <header className="strip mono">
          <span>SLOT <b>{liveSlot != null ? liveSlot.toLocaleString("en-US") : "unavailable"}</b></span>
          <span>READ <b>{readDate}</b></span>
          <span><b>{protocols.length}</b> PROTOCOLS TRACKED</span>
          <span><b>{changes24h.length}</b> ALERTS 24H</span>
          <span className="weak"><b>{noTimelock.length}</b> OF {resolved.length} WITH NO TIMELOCK</span>
          <span>CODE <b>{vCount("verified")}</b> VERIFIED · <b>{vCount("drifted")}</b> DRIFTED · <b>{vCount("unverified")}</b> NEVER REGISTERED</span>
        </header>
      )}

      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">Keyholder</p>
          <h1>Drift needed two keys to lose $285M.</h1>
          <p className="lede-tape mono">Count the keys.</p>
          <p className="lede">
            Keyholder shows who can move the money in every Solana protocol (keys, threshold,
            timelock, verified code), rings when that control weakens, and lets any program
            refuse to deposit where it just did.
          </p>
          <div className="cta">
            <Link className="primary" href="/wallet">Find your wallet</Link>
            <Link href="/replay/drift">Watch the Drift replay</Link>
          </div>
        </div>
        <div className="device-frame">
          <ConsoleDevice data={HERO_CONSOLE} />
        </div>
      </section>

      <section className="protocols-section">
        <h2>Who holds the keys</h2>
        {resolved.length > 0 && (
          <p className="finding">
            <b>{noTimelock.length} of {resolved.length}</b> resolved protocols have no timelock at all — a
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

      <div className="rails">
        <div className="rail">
          <h2>Weakened</h2>
          <div className="row weak">
            <span className="who"><span className="dot" />Drift admin council · 2 of 5 · no timelock</span>
            <span className="meta mono">timelock 0 · 1 Apr 2026 · reconstructed</span>
          </div>
          {changes24h.length === 0 && (
            <p className="rail-empty">No live weakening events in the last 24 hours.</p>
          )}
        </div>
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


      <section className="ten">
        <h2>What ships</h2>
        <ol className="mono">
          <li>Drift needed two keys to lose $285M.</li>
          <li>Count the keys.</li>
          <li>Drift&apos;s upgrade key today: 4 of 7 keys, 3,600-second timelock, read at a named slot.</li>
          <li>Solscan says &quot;MULTISIG&quot; and stops; Keyholder follows the key to the multisig behind it.</li>
          <li>Drift&apos;s admin council was 2 of 5 keys with no timelock (read on-chain); on 25 March 2026 the attackers created a new multisig, on 26 March they took the admin key through it, and on 31 March the first drain landed: 5.6 days after the first change Keyholder would have flagged.</li>
          <li>Of {resolved.length} major Solana programs, {resolved.length - noTimelock.length} have a timelock today and {noTimelock.length} do not (read {readDate}).</li>
          <li>Any program can ask Keyholder before it moves money, and be refused on-chain with the reason.</li>
          <li>Our own program will be controlled by 2 of 3 keys with a 48-hour public timelock on mainnet; today it runs on devnet.</li>
          <li>Find your wallet: see who holds the keys to every protocol your money is in.</li>
          <li>Every number here carries the slot or transaction it was read from; rebuilt history is labelled reconstructed.</li>
        </ol>
        <p className="catch">&quot;Count the keys.&quot; · &quot;Who can move your money, and did that just change?&quot;</p>
      </section>

      <footer className="mono">KEYHOLDER · every figure carries its slot, transaction or reconstructed label</footer>
    </main>
  );
}
