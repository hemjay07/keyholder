// File: apps/web/src/app/protocols/[slug]/page.tsx
// The protocol page (design/CHARTER.md, plan/CREATIVE.md v3 §5): the console in LIVE
// state, the program list with authority + evidence, the control changelog, the badge
// embed, and citations. Unresolved protocols never guess — they print the scan note.
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchProtocol, fetchEvents } from "@/lib/api-client";
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

export const dynamic = "force-dynamic";

export default async function ProtocolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const protocol = await fetchProtocol(slug).catch((err) => {
    console.error("ProtocolPage: fetchProtocol failed", err);
    return null;
  });

  if (!protocol) notFound();

  const { events } = await fetchEvents({ protocol: slug, limit: 20 }).catch((err) => {
    console.error("ProtocolPage: fetchEvents failed", err);
    return { events: [] as Awaited<ReturnType<typeof fetchEvents>>["events"] };
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
    ? `${protocol.name}: control unresolved`
    : `${protocol.name}: ${facts!.threshold} of ${facts!.members} keys, ${timelockPhrase(facts)}`;

  return (
    <main>
      <Link className="back-link" href="/">&larr; All protocols</Link>

      <section className="protocol-hero">
        <div className="hero-copy">
          <p className="kicker">Keyholder · Protocol</p>
          <h1>{headline}</h1>
          <div className="protocol-meta mono">
            <span>read {readDate}</span>
            {facts?.asOfSlot != null && <span>slot {facts.asOfSlot.toLocaleString("en-US")}</span>}
            <span>{facts?.verifiedStatus === "verified" ? "verified" : "not verified"}</span>
          </div>
          {protocol.evidenceSignature && (
            <p className="lede">
              Evidence: <a href={`https://solscan.io/tx/${protocol.evidenceSignature}`} target="_blank" rel="noreferrer" title={protocol.evidenceSignature} style={{ fontFamily: "var(--font-mono, monospace)" }}>{shortSig(protocol.evidenceSignature)}</a>
            </p>
          )}
        </div>
        <div className="device-frame">
          {consoleData ? (
            <ConsoleDevice data={consoleData} />
          ) : (
            <div className="unresolved-panel">
              <b>unresolved:</b> {protocol.evidenceNote ?? "no on-chain evidence of a multisig or governance authority was found for this program."}
            </div>
          )}
        </div>
      </section>

      <section className="programs-section">
        <h2>Programs</h2>
        {protocol.programs.length === 0 ? (
          <p className="rail-empty">No programs recorded for this protocol.</p>
        ) : (
          protocol.programs.map((prog) => (
            <div className="program-row" key={prog.programId}>
              <span>{prog.label ?? protocol.name} <span className="addr">{prog.programId}</span></span>
              <span className="meta mono">{prog.loader ?? "unknown loader"}</span>
            </div>
          ))
        )}
      </section>

      <section className="changelog-section">
        <h2>Control changelog</h2>
        {events.length === 0 ? (
          <p className="rail-empty">No control changes recorded for this protocol yet.</p>
        ) : (
          events.map((e) => (
            <div className="changelog-row" key={e.uid}>
              <span className="cl-date mono">{e.createdAt ? e.createdAt.slice(0, 16).replace("T", " ") : "—"}</span>
              <span className="cl-sev mono">{e.severity[0]?.toUpperCase()}</span>
              <span>
                {e.ruleId.replace(/_/g, " ")} <Link className="evlink" href={`/events/${e.uid}`}>view</Link>
              </span>
            </div>
          ))
        )}
      </section>

      <section className="badge-section">
        <h2>Badge embed</h2>
        <p className="lede" style={{ margin: "0 0 12px" }}>
          <img src={`/api/v1/badge/${protocol.id}.svg`} alt={`${protocol.name} control badge`} width={300} height={40} />
        </p>
        <pre className="badge-embed mono">{`<img src="https://keyholder.example/api/v1/badge/${protocol.id}.svg" alt="${protocol.name} control badge" width="300" height="40" />`}</pre>
      </section>

      <section className="citations-section">
        <h2>Citations</h2>
        <ul>
          <li>Control state read at slot {facts?.asOfSlot != null ? facts.asOfSlot.toLocaleString("en-US") : "unavailable"} ({readDate}).</li>
          {protocol.evidenceSignature ? (
            <li>Authority resolution transaction: <a href={`https://solscan.io/tx/${protocol.evidenceSignature}`} target="_blank" rel="noreferrer" title={protocol.evidenceSignature} style={{ fontFamily: "var(--font-mono, monospace)" }}>{shortSig(protocol.evidenceSignature)}</a></li>
          ) : (
            <li>{protocol.evidenceNote ?? "No authority resolution evidence on record."}</li>
          )}
          <li>Code verification status: {facts?.verifiedStatus ?? "unknown"} (verify.osec.io).</li>
        </ul>
      </section>
    </main>
  );
}
