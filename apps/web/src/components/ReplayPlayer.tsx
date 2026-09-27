"use client";
// The Drift replay player (OVERHAUL §3, P14–P19). One state, three controls:
// autoplay, a time brush you can drag, and the step list. Every frame is a real
// transaction; the choreography below (what the console, the notification,
// the vault check and the ground do at each step) is data, editable in one place.
import { useEffect, useMemo, useState } from "react";
import ConsoleDevice from "@/components/console/ConsoleDevice";
import type { ConsoleData } from "@/components/console/Console";

export interface ReplayFrame {
  slot: number;
  time: string; // ISO, from chain
  signature: string | null;
  says: string;
  phase: "before" | "warning" | "drain" | "after";
  alerts: Array<{ severity: string; rule: string }>;
}

const COUNCIL: ConsoleData = {
  protocol: "DRIFT · ADMIN COUNCIL",
  threshold: 2,
  members: 5,
  timelockSeconds: 0,
  verified: false,
  codeDrifted: false,
  weakened: false,
  slot: null,
  label: "",
};

// Choreography sheet (P19): per slot, what changes. Anything not listed carries over.
const FIRST_ALERT_SLOT = 408806252; // 25 Mar 16:58 UTC, new multisig by the council's signers
const RECOVERY_SLOT = 410344009; // 1 Apr 16:05 UTC
const STEP_MS = 3200; // autoplay dwell per step: 16 steps ≈ 51 s, under the 90 s demo cap

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} · ${d.toISOString().slice(11, 16)} UTC`;
}

export default function ReplayPlayer({ frames, leadDays }: { frames: ReplayFrame[]; leadDays: string }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Deep link: ?t=<slot> selects a frame (P37).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("t");
    if (!q) return;
    const k = frames.findIndex((f) => String(f.slot) === q);
    if (k >= 0) setI(k);
  }, [frames]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("t", String(frames[i]!.slot));
    window.history.replaceState(null, "", url);
  }, [i, frames]);

  // Autoplay: one step per STEP_MS, stops at the end.
  useEffect(() => {
    if (!playing) return;
    if (i >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setI((k) => Math.min(k + 1, frames.length - 1)), STEP_MS);
    return () => clearTimeout(id);
  }, [playing, i, frames.length]);

  const f = frames[i]!;
  const alerted = f.slot >= FIRST_ALERT_SLOT;
  const draining = f.phase === "drain";
  const recovered = f.slot >= RECOVERY_SLOT;

  const device: ConsoleData = useMemo(() => {
    const top = f.alerts[0];
    return {
      ...COUNCIL,
      weakened: alerted,
      label: top ? `${top.severity.toUpperCase()} · ${top.rule} · ${fmt(f.time).split(" · ")[0]}` : `${fmt(f.time)} · ${f.phase === "before" ? "standing: no timelock" : "no new alert"}`,
    };
  }, [f, alerted]);


  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") setI((k) => Math.min(k + 1, frames.length - 1));
    if (e.key === "ArrowLeft") setI((k) => Math.max(k - 1, 0));
    if (e.key === " ") {
      e.preventDefault();
      setPlaying((p) => !p);
    }
  };

  return (
    <section className={`player${draining ? " drain" : ""}`} aria-label="Drift replay player">
      <div className="player-stage">
        <div className="device-frame player-device">
          <ConsoleDevice data={device} />
        </div>

        {/* The alert this step would have sent, as it reaches a phone (P16). */}
        <div className={`notif${f.alerts.length && f.phase !== "before" ? " on" : ""}`} aria-hidden={!f.alerts.length}>
          <div className="notif-head mono">
            <span className="notif-app">KEYHOLDER ALERT</span>
            <span>{fmt(f.time)}</span>
          </div>
          <p className="notif-title">Drift: {(f.alerts.find((a) => a.rule !== "No timelock") ?? f.alerts[0])?.rule.toLowerCase() ?? ""}</p>
          <p className="notif-body">{f.says}</p>
        </div>

        {/* A vault that asks Keyholder before a deposit (P18). */}
        <div className={`vault-chip mono${alerted ? " refused" : ""}`}>
          <span className="vault-name">VAULT CHECK</span>
          <b>{alerted ? "REFUSED" : "PASS"}</b>
          <span className="vault-why">{alerted ? "control weakened <24 h ago" : "policy met"}</span>
        </div>
      </div>

      <div className="player-caption" aria-live="polite">
        <p className="player-date mono">{fmt(f.time)}{recovered ? " · recovery" : ""}</p>
        <p className="player-says">{f.says}</p>
        <p className="player-meta mono">
          {f.alerts.map((a) => (
            <span key={a.rule} className="player-alert">
              {a.severity} · {a.rule}
            </span>
          ))}
          {f.signature ? (
            <a href={`https://solscan.io/tx/${f.signature}`} target="_blank" rel="noreferrer">
              {f.signature.slice(0, 6)}…{f.signature.slice(-6)}
            </a>
          ) : (
            <span>signature not recorded</span>
          )}
          <span>reconstructed</span>
        </p>
      </div>

      <div className="player-controls">
        <div className="stepper-buttons">
          <button type="button" className="step-btn mono" onClick={() => { setPlaying(false); setI((k) => Math.max(k - 1, 0)); }} disabled={i === 0} aria-label="Previous step">◀ Prev</button>
          <button type="button" className="player-play mono" onClick={() => {
            if (playing) { setPlaying(false); return; }
            // Start moving at once: a click that waits a full step reads as broken.
            setI((k) => (k >= frames.length - 1 ? 0 : k + 1));
            setPlaying(true);
          }}>
            {playing ? "Pause" : i >= frames.length - 1 ? "Replay" : "Play"}
          </button>
          <button type="button" className="step-btn mono" onClick={() => { setPlaying(false); setI((k) => Math.min(k + 1, frames.length - 1)); }} disabled={i === frames.length - 1} aria-label="Next step">Next ▶</button>
          <span className="step-count mono">Step {i + 1} of {frames.length}</span>
        </div>
        <div className="stepper" role="tablist" aria-label="Replay steps" tabIndex={0} onKeyDown={onKey}>
          {(() => {
            const a = frames.findIndex((x) => x.slot === FIRST_ALERT_SLOT);
            const d = frames.findIndex((x) => x.phase === "drain");
            const at = (k: number) => ((k + 0.5) / frames.length) * 100;
            return (
              <span className="stepper-window" style={{ left: `${at(a)}%`, width: `${at(d) - at(a)}%` }}>
                <b className="mono">{leadDays} days of warning</b>
              </span>
            );
          })()}
          {frames.map((fr, idx) => {
            const prev = frames[idx - 1];
            const day = fmt(fr.time).split(" · ")[0]!;
            const newDay = !prev || fmt(prev.time).split(" · ")[0] !== day;
            return (
              <button
                key={fr.slot}
                type="button"
                role="tab"
                aria-selected={idx === i}
                className={`stepper-dot ${fr.phase}${fr.alerts.length && fr.phase !== "before" ? " alert" : ""}${idx === i ? " on" : ""}${idx < i ? " past" : ""}`}
                onClick={() => { setPlaying(false); setI(idx); }}
                title={`${fmt(fr.time)}: ${fr.says}`}
              >
                <i />
                {newDay && <em className="mono">{day}</em>}
              </button>
            );
          })}
        </div>
        <p className="stepper-hint mono">Press Play, or click a step. Orange ring = Keyholder would have sent an alert. Solid dot = money left.</p>
      </div>

      <h2 className="player-steps-h">All {frames.length} transactions</h2>
      <ol className="player-steps">
        {frames.map((fr, idx) => (
          <li key={fr.slot} className={`${fr.phase}${idx === i ? " on" : ""}`}>
            <button type="button" onClick={() => { setPlaying(false); setI(idx); }}>
              <span className="mono">{fmt(fr.time)}</span>
              <span>{fr.says}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
