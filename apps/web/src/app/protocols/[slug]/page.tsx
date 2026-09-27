// File: apps/web/src/app/protocols/[slug]/page.tsx
// The protocol page (design/CHARTER.md, plan/CREATIVE.md v3 §5): the console in LIVE
// state, the program list with authority + evidence, the control changelog, the badge
// embed, and citations. Unresolved protocols never guess — they print the scan note.
import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { fetchProtocol, fetchControlChanges } from "@/lib/api-client";
import { consoleDataFromFacts, timelockLabel } from "@/lib/console-data";

function shortSig(sig: string): string {
  return sig.length > 20 ? `${sig.slice(0, 8)}…${sig.slice(-8)}` : sig;
}

function timelockPhrase(facts: Parameters<typeof timelockLabel>[0]): string {
  const label = timelockLabel(facts);
  if (label === "none") return "no timelock";
  if (label === "no timelock feature") return "no timelock feature";
  return `${label} timelock`;
}
import ConsoleDevice from "@/components/console/ConsoleDevice";
import ProtocolLanes from "@/components/ProtocolLanes";

export const dynamic = "force-dynamic";

export default async function ProtocolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const protocol = await fetchProtocol(slug).catch((err) => {
    console.error("ProtocolPage: fetchProtocol failed", err);
    return null;
  });

  if (!protocol) notFound();

  const { changes, before: olderChanges } = await fetchControlChanges({ protocol: slug, limit: 200 }).catch((err) => {
    console.error("ProtocolPage: fetchControlChanges failed", err instanceof Error ? err.message.slice(0, 200) : "unknown");
    return { changes: [] as Awaited<ReturnType<typeof fetchControlChanges>>["changes"], before: null };
  });

  const facts = protocol.controlFacts;
  const unresolved = !facts || facts.threshold == null || facts.members == null;
  const readDate = new Date().toISOString().slice(0, 10);

  const consoleData = facts && !unresolved
    ? consoleDataFromFacts({
        name: protocol.name,
        rowLabel: `${protocol.name} · upgrade authority`,
        facts,
        weakened: !!facts.timelock && (facts.timelock.kind === "none" || facts.timelock.kind === "no_timelock_feature"),
        readDate,
      })
    : null;

  const headline = unresolved
    ? facts?.authorityKind === "immutable"
      ? `${protocol.name}: immutable, no upgrade key`
      : facts?.authorityKind === "spl_gov"
        ? `${protocol.name}: controlled by Realms governance`
        : `${protocol.name}: control unresolved`
    : `${protocol.name}: ${facts!.threshold} of ${facts!.members} keys, ${timelockPhrase(facts)}`;

  return (
    <main>
      <Link className="back-link" href="/#protocols">&larr; All protocols</Link>

      <section className="protocol-hero">
        <div className="hero-copy">
          <p className="kicker">Protocol</p>
          <h1>{headline}</h1>
          <div className="protocol-meta mono">
            {facts?.asOfSlot != null && <span>recorded at slot {facts.asOfSlot.toLocaleString("en-US")}</span>}
            {protocol.programs.map((prog) => <span key={prog.programId} title={prog.programId}>program {prog.programId.slice(0, 4)}…{prog.programId.slice(-4)}</span>)}
            <span>{facts?.verifiedStatus === "verified" ? "code verified" : facts?.verifiedStatus === "drifted" ? "code drifted from its verified build" : "code never registered for verification"} (verify.osec.io)</span>
          </div>
          {protocol.evidenceSignature && (
            <p className="lede">
              Authority read from: <a href={`https://solscan.io/tx/${protocol.evidenceSignature}`} target="_blank" rel="noreferrer" title={protocol.evidenceSignature} style={{ fontFamily: "var(--font-mono, monospace)" }}>{shortSig(protocol.evidenceSignature)}</a>
            </p>
          )}
        </div>
        <div className="device-frame">
          {consoleData ? (
            <ConsoleDevice data={consoleData} />
          ) : (
            <ConsoleDevice
              data={{
                protocol: protocol.name.toUpperCase(),
                threshold: 0,
                members: 5,
                timelockSeconds: 0,
                verified: facts?.verifiedStatus === "verified",
                codeDrifted: facts?.verifiedStatus === "drifted",
                codeKnown: facts?.verifiedStatus === "verified" || facts?.verifiedStatus === "drifted" || facts?.verifiedStatus === "unverified",
                weakened: false,
                slot: null,
                label:
                  facts?.authorityKind === "immutable"
                    ? "no upgrade authority: this program cannot be changed"
                    : facts?.authorityKind === "spl_gov"
                      ? "upgrades need a Realms governance vote"
                      : protocol.evidenceNote ?? "no multisig or governance authority found on chain",
                waiting: true,
                keysText: facts?.authorityKind === "immutable" ? "no upgrade key" : facts?.authorityKind === "spl_gov" ? "governance vote" : undefined,
                status: facts?.authorityKind === "immutable" ? "IMMUTABLE" : facts?.authorityKind === "spl_gov" ? "GOVERNANCE" : "UNRESOLVED",
              }}
            />
          )}
        </div>
      </section>

      <section className="lanes-section">
        <h2>Control history</h2>
        {changes.length === 0 ? <p className="rail-empty">No control changes recorded for this protocol yet.</p> : <ProtocolLanes changes={changes} now={new Date().toISOString()} />}
      </section>

      <section className="changelog-section">
        <h2>Every change, newest first</h2>
        {changes.length === 0 ? (
          <p className="rail-empty">No control changes recorded for this protocol yet.</p>
        ) : (
          <>
            {changes.slice(0, 12).map((c) => (
              <div className="changelog-row" key={c.uid}>
                <span className="cl-date mono">{c.blockTime.slice(0, 16).replace("T", " ")}</span>
                <span>{c.kind === "upgrade" ? "Program upgraded" : c.kind === "set_authority" ? "Upgrade authority changed" : "Multisig settings changed"}</span>
                <a className="evlink mono" href={`https://solscan.io/tx/${c.signature}`} target="_blank" rel="noreferrer">{c.signature.slice(0, 6)}…{c.signature.slice(-6)}</a>
              </div>
            ))}
            {(olderChanges || changes.length > 12) && <Link className="rail-more mono" href={`/feed?protocol=${protocol.id}`}>Every change &rarr;</Link>}
          </>
        )}
      </section>

      <details className="badge-section">
        <summary className="mono">Embed this badge</summary>
        <p className="lede" style={{ margin: "0 0 12px" }}>
          <img src={`/api/v1/badge/${protocol.id}.svg`} alt={`${protocol.name} control badge`} width={300} height={40} />
        </p>
        <pre className="badge-embed mono">{`<img src="${origin}/api/v1/badge/${protocol.id}.svg" alt="${protocol.name} control badge" width="300" height="40" />`}</pre>
      </details>

    </main>
  );
}
