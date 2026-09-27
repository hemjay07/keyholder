// /replay/drift: the Drift incident replayed through Keyholder's rules. Every
// step is a real transaction; the alerts are what the risk engine fires on the
// reconstructed state (latest replay run in the database).
import Link from "next/link";
import { fetchDriftReplay } from "@/lib/api-client";
import { loadDriftSteps, type DriftStep } from "@/lib/drift-steps";
import HomeStory from "@/components/HomeStory";
import type { ConsoleData } from "@/components/console/Console";

export const dynamic = "force-dynamic";

// The council at the first alert (step 4, 25 Mar 2026): read from the replay's
// reconstructed state, labelled as such.
const COUNCIL_AT_FIRST_ALERT: ConsoleData = {
  protocol: "DRIFT · ADMIN",
  threshold: 2,
  members: 5,
  timelockSeconds: 0,
  noTimelockFeature: false,
  verified: false,
  codeDrifted: false,
  weakened: true,
  slot: 408806252,
  label: "new multisig · 25 Mar 2026 · reconstructed",
};

const RULE_WORDS: Record<string, string> = {
  no_timelock: "No timelock",
  new_multisig_created_by_controller: "New multisig by a controller",
  admin_changed: "Admin changed",
  privileged_ix_by_new_admin: "Privileged action by a new admin",
  durable_nonce_by_controller: "Durable nonce by a controller",
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} · ${d.toISOString().slice(11, 16)} UTC`;
}

function shortSig(sig: string): string {
  return `${sig.slice(0, 6)}…${sig.slice(-6)}`;
}

function days(seconds: number): string {
  return (seconds / 86400).toFixed(1);
}

export default async function DriftReplayPage() {
  let replay: Awaited<ReturnType<typeof fetchDriftReplay>> = null;
  let steps: DriftStep[] = [];
  let readError = false;
  try {
    [replay, steps] = await Promise.all([fetchDriftReplay(), Promise.resolve(loadDriftSteps())]);
  } catch {
    readError = true;
  }

  if (readError || !replay || replay.leadTimeSeconds == null || steps.length === 0) {
    return (
      <main>
          <section className="protocol-hero">
          <div className="hero-copy">
            <p className="kicker">Replay</p>
            <h1>The Drift replay is unavailable right now.</h1>
            <p className="lede">The replay run could not be read. No figure is shown in its place.</p>
          </div>
        </section>
      </main>
    );
  }

  const alertsBySlot = new Map<number, typeof replay.frames>();
  for (const f of replay.frames) {
    const list = alertsBySlot.get(Number(f.slot)) ?? [];
    list.push(f);
    alertsBySlot.set(Number(f.slot), list);
  }

  const firstAlert = steps.find((s) => s.slot === Number(replay!.firstAlertSlot));
  const firstDrain = steps.find((s) => s.phase === "drain");
  const lead = days(replay.leadTimeSeconds);

  // The span bar runs from the first alert's day to the day after the last step.
  const t = (iso: string) => new Date(iso).getTime();
  const firstStep = steps[0]!;
  const lastStep = steps[steps.length - 1]!;
  const spanStart = firstAlert ? new Date(firstAlert.time.slice(0, 10) + "T00:00:00Z").getTime() : t(firstStep.time);
  const spanEnd = new Date(lastStep.time.slice(0, 10) + "T00:00:00Z").getTime() + 86400000;
  const pct = (iso: string) => Math.max(0, Math.min(100, ((t(iso) - spanStart) / (spanEnd - spanStart)) * 100));
  const dayTicks: string[] = [];
  for (let d = spanStart; d < spanEnd; d += 86400000) dayTicks.push(new Date(d).toISOString());

  return (
    <main className="replay">

      <section className="replay-head">
        <div>
          <p className="kicker">Replay · reconstructed</p>
          <h1>{lead} days of warning.</h1>
          <p className="lede mono">Drift lost $285M on 1 April 2026.</p>
          <p className="lede">
            Every step before the drain was on-chain. Replayed through Keyholder&apos;s rules, the first alert fires on
            25 March, when the council&apos;s signers set up a second multisig with no timelock. The first withdrawal
            lands {lead} days later.
          </p>
          <p className="replay-meta mono">
            {steps.length} transactions · slots {Number(replay.fromSlot).toLocaleString("en-US")}–{Number(replay.toSlot).toLocaleString("en-US")} · {replay.frames.length} alerts
          </p>
        </div>
      </section>

      {firstAlert && firstDrain && (
        <section className="span-section" aria-label={`Warning window: ${lead} days from the first alert to the first withdrawal`}>
          <div className="span-bar">
            {dayTicks.map((d) => (
              <span key={d} className="span-day mono" style={{ left: `${pct(d)}%` }}>{fmtTime(d).split(" · ")[0]}</span>
            ))}
            <span className="span-window" style={{ left: `${pct(firstAlert.time)}%`, width: `${pct(firstDrain.time) - pct(firstAlert.time)}%` }}>
              <b className="mono">{lead} days</b>
            </span>
            {steps.filter((s) => s.phase !== "before").map((s) => (
              <span
                key={s.slot}
                className={`span-mark ${alertsBySlot.has(s.slot) ? "alert" : ""} ${s.phase}`}
                style={{ left: `${pct(s.time)}%` }}
                title={`${fmtTime(s.time)} · ${s.says}`}
              />
            ))}
          </div>
          <div className="span-legend mono">
            <span><i className="span-mark alert" /> Keyholder alert</span>
            <span><i className="span-mark drain" /> money leaves</span>
          </div>
        </section>
      )}

      <section className="steps-section">
        <h2>Step by step</h2>
      </section>
      <HomeStory compact label="The Drift incident, step by step" beats={steps.map((s) => {
        const alerts = alertsBySlot.get(s.slot) ?? [];
        const warned = s.phase !== "before";
        const top = alerts.find((a) => !(a.ruleId === "no_timelock" && s.phase === "before"));
        return {
          id: String(s.slot),
          device: {
            ...COUNCIL_AT_FIRST_ALERT,
            protocol: "DRIFT · ADMIN COUNCIL",
            weakened: warned,
            label: top ? `${top.severity.toUpperCase()} · ${RULE_WORDS[top.ruleId] ?? top.ruleId} · ${fmtTime(s.time).split(" · ")[0]}` : `${fmtTime(s.time)} · ${s.phase === "before" ? "standing: no timelock" : "no new alert"}`,
          },
          body: (
            <div className={`step ${s.phase}`}>
              <span className="step-time mono">{fmtTime(s.time)}</span>
              <p className="step-says">{s.says}</p>
              {alerts.map((a) => (
                <p key={a.ruleId} className={`step-alert ${a.ruleId === "no_timelock" && s.phase === "before" ? "standing" : ""}`}>
                  <span className="mono">{a.ruleId === "no_timelock" && s.phase === "before" ? "Standing" : a.severity}</span> {RULE_WORDS[a.ruleId] ?? a.ruleId}
                </p>
              ))}
              {/^[1-9A-HJ-NP-Za-km-z]{86,88}$/.test(s.signature) ? (
                <a className="step-sig mono" href={`https://solscan.io/tx/${s.signature}`} target="_blank" rel="noreferrer" title={s.signature}>{shortSig(s.signature)}</a>
              ) : (
                <span className="step-sig mono">signature not recorded</span>
              )}
            </div>
          ),
        };
      })} />

      <section className="citations-section">
        <h2>How this was rebuilt</h2>
        <ul>
          <li>Each step is a real mainnet transaction; block times read from chain by slot (27 Sep 2026).</li>
          <li>Alerts are what Keyholder&apos;s risk rules fire on the control state rebuilt from those transactions. They were not live in March.</li>
          <li>Lead time is measured from the first alert ({firstAlert ? fmtTime(firstAlert.time) : "—"}) to the first withdrawal ({firstDrain ? fmtTime(firstDrain.time) : "—"}): {replay.leadTimeSeconds.toLocaleString("en-US")} s.</li>
          <li>Loss figure: rekt.news, &ldquo;Drift Protocol - REKT&rdquo;, April 2026.</li>
        </ul>
      </section>
    </main>
  );
}
