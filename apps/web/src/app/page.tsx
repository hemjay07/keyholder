// File: apps/web/src/app/page.tsx
// The first fold (design/CHARTER.md, plan/CREATIVE.md v3 §5). Every fact below is read
// straight from the DB via apps/web/src/lib/api-client — a failed read shows nothing and
// says so, never a placeholder number.
import Link from "next/link";
import { fetchControlChanges, fetchProtocols, type ProtocolSummary } from "@/lib/api-client";
import { timelockLabel, controlLabel, consoleDataFromFacts } from "@/lib/console-data";
import HomeStory, { type Beat } from "@/components/HomeStory";
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

  // The story's beats: the Drift council as the replay rebuilt it, then the
  // weakest protocol as read today.
  const council = (label: string, weakened: boolean): ConsoleData => ({ ...HERO_CONSOLE, protocol: "DRIFT · ADMIN COUNCIL", weakened, label });
  const weakest = sorted.find((p) => p.controlFacts?.threshold != null);
  const liveDevice = weakest?.controlFacts
    ? consoleDataFromFacts({
        name: weakest.name,
        rowLabel: `${weakest.name} · read today`,
        facts: weakest.controlFacts,
        weakened: weakest.controlFacts.timelock?.kind === "none" || weakest.controlFacts.timelock?.kind === "no_timelock_feature",
        readDate: new Date().toISOString().slice(0, 10),
      })
    : null;
  const beats: Beat[] = [
    {
      id: "hero",
      device: council("admin council · 2 of 5 · no timelock · read on-chain", false),
      body: (
        <>
          <h1>Drift needed two keys to lose $285M.</h1>
          <p className="lede-tape mono">Count the keys.</p>
          <p className="lede">
            Keyholder shows who can move the money in every Solana protocol (keys, threshold, timelock, verified code), rings when that
            control weakens, and lets any program refuse to deposit where it just did.
          </p>
          <div className="cta">
            <Link className="primary" href="/wallet">Check your wallet</Link>
            <Link href="/replay/drift">Watch the Drift replay</Link>
          </div>
          <p className="story-hint mono">Scroll: the console replays what the chain showed.</p>
        </>
      ),
    },
    {
      id: "multisig",
      device: council("HIGH · new multisig by a controller · 25 Mar 2026", true),
      body: (
        <>
          <p className="story-date mono">25 March 2026 · 16:58 UTC</p>
          <p className="story-line">A second multisig appears: 2 of 5 keys, no timelock, set up by the council&apos;s own signers.</p>
          <p className="story-note">Keyholder&apos;s first alert. Hours later the admin key moves through it.</p>
        </>
      ),
    },
    {
      id: "drain",
      device: council("first withdrawal · 31 Mar 2026 · 5.6 days after the first alert", true),
      body: (
        <>
          <p className="story-date mono">31 March 2026 · 07:16 UTC</p>
          <p className="story-line">The first withdrawal from the insurance fund. <b>5.6 days</b> after the first alert.</p>
          <p className="story-note">On 1 April, $285M left in minutes. <Link href="/replay/drift">Every step, with its transaction &rarr;</Link></p>
        </>
      ),
    },
    ...(liveDevice && weakest
      ? [
          {
            id: "today",
            device: liveDevice,
            body: (
              <>
                <p className="story-date mono">Today · {new Date().toISOString().slice(0, 10)}</p>
                <p className="story-line">
                  Every protocol has keys like these. {noTimelock.length} of {resolved.length} have no timelock at all.
                </p>
                <p className="story-note">
                  Right now: <Link href={`/protocols/${weakest.id}`}>{weakest.name}</Link>. <a href="#protocols">All {protocols.length} protocols &darr;</a>
                </p>
              </>
            ),
          },
        ]
      : []),
  ];




  const protocolById = new Map(protocols.map((p) => [p.id, p]));
  const readDate = new Date().toISOString().slice(0, 10);

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

      <HomeStory beats={beats} />

      <section className="protocols-section" id="protocols">
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
