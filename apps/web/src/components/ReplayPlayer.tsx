"use client";
// The Drift replay player (OVERHAUL §3, P14–P19). One state, three controls:
// autoplay, a time brush you can drag, and the step list. Every frame is a real
// transaction; the choreography below (what the console, the notification,
// the vault check and the ground do at each step) is data, editable in one place.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const ADMIN_MOVED_SLOT = 408886958; // 26 Mar 01:46 UTC
const RECOVERY_SLOT = 410344009; // 1 Apr 16:05 UTC
const STEP_MS = 3600; // autoplay dwell per step: 16 steps ≈ 58 s, under the 90 s demo cap

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} · ${d.toISOString().slice(11, 16)} UTC`;
}

export default function ReplayPlayer({ frames, leadDays }: { frames: ReplayFrame[]; leadDays: string }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const t0 = new Date(Date.UTC(2026, 2, 1)).getTime();
  const t1 = new Date(Date.UTC(2026, 3, 3)).getTime();
  const pct = useCallback((iso: string) => ((new Date(iso).getTime() - t0) / (t1 - t0)) * 100, [t0, t1]);

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

  const companion: ConsoleData | null = alerted
    ? {
        ...COUNCIL,
        protocol: "NEW MULTISIG",
        weakened: true,
        label: f.slot >= ADMIN_MOVED_SLOT ? "holds Drift's admin role" : "created 25 Mar by council signers",
      }
    : null;

  // Brush drag: pointer x → the last frame at or before that time.
  const seekToX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const t = t0 + ((clientX - r.left) / r.width) * (t1 - t0);
      let k = 0;
      frames.forEach((fr, idx) => {
        if (new Date(fr.time).getTime() <= t) k = idx;
      });
      setPlaying(false);
      setI(k);
    },
    [frames, t0, t1]
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") setI((k) => Math.min(k + 1, frames.length - 1));
    if (e.key === "ArrowLeft") setI((k) => Math.max(k - 1, 0));
    if (e.key === " ") {
      e.preventDefault();
      setPlaying((p) => !p);
    }
  };

  const days: number[] = [];
  for (let d = t0; d <= t1; d += 86400000) days.push(d);

  return (
    <section className={`player${draining ? " drain" : ""}`} aria-label="Drift replay player">
      <div className="player-stage">
        <div className="device-frame player-device">
          <ConsoleDevice data={device} companion={companion} />
        </div>

        {/* The alert, as it would have reached a subscriber's phone (P16). */}
        <div className={`notif${alerted ? " on" : ""}`} aria-hidden={!alerted}>
          <div className="notif-head mono">
            <span className="notif-app">KEYHOLDER</span>
            <span>25 Mar · 16:58 UTC</span>
          </div>
          <p className="notif-title">Drift: new multisig by the admin council&apos;s signers</p>
          <p className="notif-body">2 of 5 keys, no timelock. Nothing has moved yet.</p>
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
        <button type="button" className="player-play mono" onClick={() => (i >= frames.length - 1 ? (setI(0), setPlaying(true)) : setPlaying((p) => !p))}>
          {playing ? "Pause" : i >= frames.length - 1 ? "Replay" : "Play"}
        </button>
        <div
          ref={trackRef}
          className="brush"
          role="slider"
          tabIndex={0}
          aria-label="Replay time"
          aria-valuemin={0}
          aria-valuemax={frames.length - 1}
          aria-valuenow={i}
          aria-valuetext={fmt(f.time)}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            seekToX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) seekToX(e.clientX);
          }}
        >
          {days.map((d) => {
            const dt = new Date(d);
            const label = dt.getUTCDate() === 1 || dt.getUTCDate() % 7 === 1 ? `${dt.getUTCDate()} ${dt.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}` : null;
            return (
              <span key={d} className={`brush-day${label ? " labelled" : ""}`} style={{ left: `${((d - t0) / (t1 - t0)) * 100}%` }}>
                {label && <em className="mono">{label}</em>}
              </span>
            );
          })}
          <span
            className="brush-window"
            style={{ left: `${pct(frames.find((x) => x.slot === FIRST_ALERT_SLOT)!.time)}%`, width: `${pct(frames.find((x) => x.phase === "drain")!.time) - pct(frames.find((x) => x.slot === FIRST_ALERT_SLOT)!.time)}%` }}
          >
            <b className="mono">{leadDays} days<span> of warning</span></b>
          </span>
          {frames.map((fr, idx) => (
            <button
              key={fr.slot}
              type="button"
              tabIndex={-1}
              className={`brush-mark ${fr.alerts.length ? "alert" : ""} ${fr.phase}${idx === i ? " on" : ""}`}
              style={{ left: `${pct(fr.time)}%` }}
              onClick={(e) => {
                e.stopPropagation();
                setPlaying(false);
                setI(idx);
              }}
              aria-label={`${fmt(fr.time)}: ${fr.says}`}
            />
          ))}
          <span className="brush-head" style={{ left: `${pct(f.time)}%` }} />
        </div>
      </div>

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
