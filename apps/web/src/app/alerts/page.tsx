// /alerts: subscribe a signed webhook to the protocols you care about.
// Telegram, email and X senders exist in the plan but are off until their
// tokens exist; they are listed as not live, never offered as working.
import Link from "next/link";
import { fetchProtocols } from "@/lib/api-client";
import AlertsSignup from "@/components/AlertsSignup";
import ConsoleDevice from "@/components/console/ConsoleDevice";
import type { ConsoleData } from "@/components/console/Console";

export const dynamic = "force-dynamic";

// What an alert looks like when it fires: the Drift replay's first alert.
const ALERT_EXAMPLE: ConsoleData = {
  protocol: "DRIFT · ADMIN",
  threshold: 2,
  members: 5,
  timelockSeconds: 0,
  verified: false,
  codeDrifted: false,
  weakened: true,
  slot: null,
  label: "HIGH · new multisig by a controller · 25 Mar 2026 · replay",
};

export default async function AlertsPage() {
  let protocols: Array<{ id: string; name: string }> = [];
  try {
    protocols = (await fetchProtocols()).map((p) => ({ id: p.id, name: p.name }));
  } catch {
    protocols = [];
  }
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
          {protocols.length ? <AlertsSignup protocols={protocols} /> : <p className="feed-error">Protocols could not be read right now.</p>}
          <p className="alerts-channels mono">
            Channels live now: signed webhook. Telegram, email and X: not live yet.
          </p>
        </div>
        <div className="device-frame">
          <ConsoleDevice data={ALERT_EXAMPLE} />
        </div>
      </section>
    </main>
  );
}
