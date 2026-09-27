// /alerts: subscribe a signed webhook to the protocols you care about.
// Telegram, email and X senders exist in the plan but are off until their
// tokens exist; they are listed as not live, never offered as working.
import Link from "next/link";
import { fetchProtocols, fetchDriftReplay } from "@/lib/api-client";
import AlertsSignup from "@/components/AlertsSignup";

export const dynamic = "force-dynamic";

// Plain-language versions of the risk rules in packages/risk/src/rules.ts (P31).
const RULES_PLAIN: Array<[string, string]> = [
  ["critical", "a protocol's admin account moves to a new address"],
  ["critical", "the timelock is cut to zero, or fewer keys are now required"],
  ["critical / high", "a multisig can act with no timelock (critical at 2 keys or fewer)"],
  ["critical / high", "the upgrade key moves to a new address (critical if to a single key)"],
  ["high", "the upgrade key is held by one key, not a multisig"],
  ["high", "the controller's own signers set up a new multisig"],
  ["high", "a newly assigned admin uses its admin powers"],
  ["medium / high", "a controller creates a durable nonce: a transaction signed now, sent later"],
  ["medium", "the program's code no longer matches its verified build"],
];

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ protocols?: string }> }) {
  const pre = (await searchParams).protocols?.split(",").filter(Boolean);
  let protocols: Array<{ id: string; name: string }> = [];
  try {
    protocols = (await fetchProtocols()).map((p) => ({ id: p.id, name: p.name }));
  } catch {
    protocols = [];
  }
  // The alert a subscriber would have received: the replay's first alert on Drift,
  // in the webhook's own body shape (apps/worker RiskDeltaNotification).
  const replay = await fetchDriftReplay().catch(() => null);
  const first = replay?.frames.find((f) => f.slot === replay.firstAlertSlot) ?? replay?.frames[0] ?? null;
  const body = first
    ? JSON.stringify({ protocol_id: "drift", rule_id: first.ruleId, severity: first.severity, explanation: first.explanation, facts: first.facts }, null, 2)
    : null;
  return (
    <main className="alerts-page">
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">Alerts</p>
          <h1>Get told the moment control weakens.</h1>
          <p className="lede">
            When a protocol&apos;s keys, threshold or timelock change, Keyholder decodes it from chain and posts it to you, signed.
            In the Drift replay the first alert fires <Link href="/replay/drift">5.6 days before the first withdrawal</Link>.
          </p>
          {protocols.length ? <AlertsSignup protocols={protocols} preselect={pre} /> : <p className="feed-error">Protocols could not be read right now.</p>}
          <details className="alerts-rules">
            <summary className="mono">What sends an alert</summary>
            <ul>
              {RULES_PLAIN.map(([sev, text]) => <li key={text}><span className="mono">{sev}</span> {text}</li>)}
            </ul>
          </details>
          <p className="alerts-channels mono">
            Channels live now: signed webhook. Telegram, email and X: not live yet.
          </p>
        </div>
        {body && (
          <figure className="alert-sample">
            <figcaption className="mono">What you would have received · 25 Mar 2026 16:58 UTC · slot {first!.slot.toLocaleString("en-US")}</figcaption>
            <div className="as-head mono">
              <span>POST https://your-endpoint</span>
              <span>X-Keyholder-Signature: t=&lt;unix time&gt;,v1=&lt;hmac-sha256&gt;</span>
            </div>
            <pre className="mono">{body.length > 1400 ? body.slice(0, 1400) + "\n  …" : body}</pre>
            <p className="as-note mono">Drift&apos;s first withdrawal came 5.6 days later.</p>
          </figure>
        )}
      </section>
    </main>
  );
}
