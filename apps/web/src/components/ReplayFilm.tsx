"use client";
// The Drift replay as one directed film (design/EXPERIENCE.md, rules R1–R9).
// One stage (the console) with three lanes on a real time axis under it. Seven
// moments; scrolling moves one moment per step (each moment is a scroll
// section), Play scrolls for you, Prev/Next and arrow keys jump. The stage
// transforms per moment; it is never replaced.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConsoleDevice from "@/components/console/ConsoleDevice";
import type { ConsoleData } from "@/components/console/Console";

export interface FilmEvent {
  slot: number;
  time: string; // ISO from chain
  signature: string | null;
  says: string;
  lane: "keyholder" | "admin" | "money" | "context";
}

// ---- The film's timing sheet: every moment, in one place (R7). ----
interface Moment {
  id: string;
  at: string; // the "now" line, ISO
  ground: "bone" | "warm" | "ink";
  date: string;
  caption: string;
  lampOn: boolean;
  readout: string;
  window: "none" | "open" | "closed"; // the orange alert→money window (R4)
  vault: "hidden" | "pass" | "refused";
  keys: "council" | "focus"; // camera emphasis
}

const T_ALERT = "2026-03-25T16:58:31Z";
const T_DRAIN = "2026-03-31T07:16:19Z";

const MOMENTS: Moment[] = [
  { id: "setup", at: "2026-03-01T00:00:00Z", ground: "bone", date: "Drift · admin council", caption: "Drift's admin council needed 2 of 5 keys, with no timelock. It stayed that way the whole time.", lampOn: false, readout: "2 of 5 · no timelock · standing", window: "none", vault: "hidden", keys: "focus" },
  { id: "routine", at: "2026-03-02T17:09:00Z", ground: "bone", date: "2 March 2026", caption: "A routine settings change through the council. This is what normal looked like.", lampOn: false, readout: "2 Mar · routine change", window: "none", vault: "hidden", keys: "council" },
  { id: "alert", at: T_ALERT, ground: "warm", date: "25 March 2026 · 16:58 UTC", caption: "The council's own signers create a second multisig: 2 of 5, no timelock. Keyholder's first alert.", lampOn: true, readout: "ALERT · new multisig by controller · 25 Mar", window: "open", vault: "refused", keys: "council" },
  { id: "takeover", at: "2026-03-26T16:08:00Z", ground: "warm", date: "26 March 2026", caption: "Drift's admin role moves to that new multisig, now the attacker's. A market is switched on and its limits raised.", lampOn: true, readout: "admin moved · 3 admin actions · 26 Mar", window: "open", vault: "refused", keys: "council" },
  { id: "money", at: T_DRAIN, ground: "ink", date: "31 March 2026 · 07:16 UTC", caption: "A durable nonce is staged; hours later, the first withdrawal from the insurance fund. 5.6 days after the alert.", lampOn: true, readout: "first withdrawal · 31 Mar", window: "closed", vault: "refused", keys: "council" },
  { id: "loss", at: "2026-04-01T20:03:00Z", ground: "ink", date: "1 April 2026", caption: "$285M leaves in minutes. The admin role is taken back, too late.", lampOn: true, readout: "$285M lost · 1 Apr", window: "closed", vault: "refused", keys: "council" },
  { id: "end", at: "2026-04-03T00:00:00Z", ground: "bone", date: "Count the keys.", caption: "5.6 days of warning. Every step was on-chain.", lampOn: true, readout: "5.6 days of warning", window: "closed", vault: "refused", keys: "focus" },
];
const AUTOPLAY_MS = 6500; // per moment: 7 × 6.5 s ≈ 46 s
const FIRST_VISIT_STOP = 2; // first visit plays itself to the alert, then waits

// Time is compressed to what happened (R9 keeps it honest: the quiet weeks are
// labelled as compressed). 1–24 Mar take 14 % of the width; 24 Mar–3 Apr take 86 %.
const AXIS_FROM = Date.UTC(2026, 2, 1);
const AXIS_KNEE = Date.UTC(2026, 2, 24);
const AXIS_TO = Date.UTC(2026, 3, 3);
const KNEE = 14;
const x = (iso: string) => {
  const t = new Date(iso).getTime();
  if (t <= AXIS_KNEE) return Math.max(0, ((t - AXIS_FROM) / (AXIS_KNEE - AXIS_FROM)) * KNEE);
  return KNEE + ((t - AXIS_KNEE) / (AXIS_TO - AXIS_KNEE)) * (100 - KNEE);
};

/** Elapsed warning time at a moment: 0 before the alert, frozen at the first withdrawal. */
function warning(atIso: string): { d: number; h: number; frozen: boolean; started: boolean } {
  const a = new Date(T_ALERT).getTime();
  const z = new Date(T_DRAIN).getTime();
  const t = new Date(atIso).getTime();
  if (t < a) return { d: 0, h: 0, frozen: false, started: false };
  const ms = Math.min(t, z) - a;
  return { d: Math.floor(ms / 86400000), h: Math.floor((ms % 86400000) / 3600000), frozen: t >= z, started: true };
}

export default function ReplayFilm({ events, leadDays }: { events: FilmEvent[]; leadDays: string }) {
  const [m, setM] = useState(0);
  const [playing, setPlaying] = useState(false);
  const sections = useRef<Array<HTMLElement | null>>([]);
  const scrollingTo = useRef(false);
  const mo = MOMENTS[m]!;

  // Scroll position → moment (each moment is one scroll section; the stage is sticky).
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        if (scrollingTo.current) return;
        for (const e of entries) if (e.isIntersecting) setM(Number((e.target as HTMLElement).dataset.m));
      },
      { rootMargin: "-50% 0px -50% 0px" }
    );
    sections.current.forEach((s) => s && io.observe(s));
    return () => io.disconnect();
  }, []);

  const go = useCallback((k: number, smooth = true) => {
    const t = Math.max(0, Math.min(MOMENTS.length - 1, k));
    setM(t);
    const el = sections.current[t];
    if (el) {
      scrollingTo.current = true;
      el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
      window.setTimeout(() => (scrollingTo.current = false), 900);
    }
  }, []);

  // Deep link ?m=<id>, and keep the URL on the current moment.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("m");
    const k = q ? MOMENTS.findIndex((x) => x.id === q) : -1;
    if (k > 0) {
      go(k, false);
      return;
    }
    // First visit: play itself to the alert, then wait for the viewer.
    let seen = false;
    try {
      seen = sessionStorage.getItem("kh-replay-seen") === "1";
      sessionStorage.setItem("kh-replay-seen", "1");
    } catch {}
    if (!seen && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(true);
  }, [go]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("m", MOMENTS[m]!.id);
    window.history.replaceState(null, "", url);
  }, [m]);

  // Play: advance one moment per AUTOPLAY_MS; the first unprompted run stops at the alert.
  const firstRun = useRef(true);
  useEffect(() => {
    if (!playing) return;
    const stopAt = firstRun.current ? FIRST_VISIT_STOP : MOMENTS.length - 1;
    if (m >= stopAt) {
      setPlaying(false);
      firstRun.current = false;
      return;
    }
    const id = window.setTimeout(() => go(m + 1), m === 0 ? 2600 : AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [playing, m, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea")) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setPlaying(false); go(m + 1); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setPlaying(false); go(m - 1); }
      if (e.key === " ") { e.preventDefault(); firstRun.current = false; setPlaying((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [m, go]);

  const device: ConsoleData = useMemo(
    () => ({ protocol: "DRIFT · ADMIN COUNCIL", threshold: 2, members: 5, timelockSeconds: 0, verified: false, codeDrifted: false, weakened: mo.lampOn, slot: null, label: mo.readout }),
    [mo]
  );

  const now = x(mo.at);
  const w0 = warning(mo.at);
  const targetH = w0.d * 24 + w0.h;
  const [shownH, setShownH] = useState(targetH);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShownH(targetH); return; }
    const from = shownH; const start = performance.now(); let raf = 0;
    const tick = (t: number) => { const k = Math.min(1, (t - start) / 1400); setShownH(Math.round(from + (targetH - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetH]);
  const w = { ...w0, d: Math.floor(shownH / 24), h: shownH % 24 };
  const winL = x(T_ALERT);
  const winR = mo.window === "closed" ? x(T_DRAIN) : mo.window === "open" ? Math.max(winL, now) : winL;
  const lanes: Array<{ key: FilmEvent["lane"]; label: string }> = [
    { key: "keyholder", label: "Keyholder alerts" },
    { key: "money", label: "Money out" },
  ];

  return (
    <div className={`film g-${mo.ground} cam-${mo.id}`}>
      <div className="film-stage" aria-live="polite">
        <div className="film-scene">
          <div className="film-mini" aria-hidden="true">
            <div className={`fm-row${mo.lampOn ? " weak" : ""}`}>
              <i className="fm-lamp" />
              <b className="mono">Drift admin council</b>
              <span className="fm-keys">{[0, 1, 2, 3, 4].map((k) => <em key={k} className={k < 2 ? "on" : ""} />)}</span>
              <span className="mono">2/5 · no timelock</span>
            </div>
          </div>
          <div className="film-console">
            <ConsoleDevice data={device} />
          </div>
          <aside className="film-side">
            <div className={`film-count${w.started ? " on" : ""}${w.frozen ? " frozen" : ""}`}>
              <span className="mono film-side-label">{w.frozen ? "Warning Keyholder would have given" : w.started ? "Warning so far" : "Warning"}</span>
              <b className="mono">{w.started ? <>{w.d}<small>d</small> {String(w.h).padStart(2, "0")}<small>h</small></> : "—"}</b>
              <span className="mono film-side-sub">{w.frozen ? "then the money moved" : w.started ? "since the first alert, nothing has moved yet" : "no alert yet"}</span>
            </div>
          </aside>
        </div>

        <div className="film-note">
          <p className="film-date mono">{mo.date}</p>
          <p className="film-caption">{mo.caption}</p>
          {mo.id === "end" && (
            <p className="film-end-link"><a href="/">See today&apos;s weakest protocol →</a> <a href="/policy#proof">Watch a vault refuse on-chain →</a></p>
          )}
        </div>

        <div className="film-lanes" role="group" aria-label="Timeline, 1 March to 3 April 2026">
          <div className="film-axis mono">
            <span className="film-quiet" style={{ left: 0, width: `${KNEE}%` }}>1–24 Mar · quiet, compressed</span>
            {[25, 26, 27, 28, 29, 30, 31].map((d) => (
              <span key={d} style={{ left: `${x(`2026-03-${d}T00:00:00Z`)}%` }}>{d} Mar</span>
            ))}
            {[1, 2].map((d) => (
              <span key={`a${d}`} style={{ left: `${x(`2026-04-0${d}T00:00:00Z`)}%` }}>{d} Apr</span>
            ))}
          </div>
          {mo.window !== "none" && (
            <div className="film-window" style={{ left: `${winL}%`, width: `${winR - winL}%` }}>
              {mo.window === "closed" && <b className="mono">{leadDays} days of warning</b>}
            </div>
          )}
          {lanes.map((l) => (
            <div key={l.key} className="film-lane">
              <span className="film-lane-label mono">{l.label}</span>
              <div className="film-lane-track">
                {events
                  .filter((e) => e.lane === l.key && x(e.time) <= now + 0.01)
                  .map((e) => (
                    <a
                      key={e.slot}
                      className={`film-tick ${l.key}`}
                      style={{ left: `${x(e.time)}%` }}
                      href={e.signature ? `https://solscan.io/tx/${e.signature}` : undefined}
                      target="_blank"
                      rel="noreferrer"
                      title={`${e.says}${e.signature ? " (open transaction)" : ""}`}
                    />
                  ))}
              </div>
            </div>
          ))}
          <span className="film-now" style={{ left: `${now}%` }} />
          {/* The timeline is the progress bar: click a stretch to jump to that moment. */}
          <div className="film-hits">
            {MOMENTS.map((x2, i) => {
              const l0 = i === 0 ? 0 : x(x2.at);
              const r0 = i === MOMENTS.length - 1 ? 100 : x(MOMENTS[i + 1]!.at);
              return <button key={x2.id} type="button" tabIndex={-1} aria-label={x2.date} className={i === m ? "on" : ""} style={{ left: `${l0}%`, width: `${Math.max(0, r0 - l0)}%` }} onClick={() => { setPlaying(false); go(i); }} />;
            })}
          </div>
          <button type="button" className="film-play mono" aria-label={playing ? "Pause" : "Play"} onClick={() => { firstRun.current = false; if (playing) { setPlaying(false); return; } if (m >= MOMENTS.length - 1) go(0); else go(m + 1); setPlaying(true); }}>
            {playing ? "❚❚" : "▶"}
          </button>
          {m <= FIRST_VISIT_STOP && !playing && <span className="film-hint mono">Scroll to continue</span>}
        </div>

      </div>

      {/* Scroll track: one section per moment. The stage above is sticky. */}
      <div className="film-track" aria-hidden="true">
        {MOMENTS.map((x, i) => (
          <section key={x.id} data-m={i} ref={(el) => { sections.current[i] = el; }} className="film-section" />
        ))}
      </div>
    </div>
  );
}
