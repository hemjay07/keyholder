"use client";
// The home story (REVAMP 1): the console holds its place while the reader
// scrolls through the Drift incident; each beat sets the console's state, so
// the keys, lamp and readout act the story. The last beat hands over to a live
// protocol read today. Beats are real, from the replay (design/REVAMP.md).
import { useEffect, useRef, useState, type ReactNode } from "react";
import ConsoleDevice from "@/components/console/ConsoleDevice";
import type { ConsoleData } from "@/components/console/Console";

export interface Beat {
  id: string;
  device: ConsoleData;
  body: ReactNode;
}

function timelockText(d: ConsoleData): string {
  if (d.waiting) return "not read";
  if (d.noTimelockFeature) return "no timelock";
  const t = d.timelockSeconds;
  if (t === 0) return "no timelock";
  return t % 86400 === 0 ? `${t / 86400} d timelock` : t < 3600 ? `${t} s timelock` : `${+(t / 3600).toFixed(1)} h timelock`;
}

/** Phone only: a slim pinned read-out of the console's state for the current beat. */
function StoryHud({ d }: { d: ConsoleData }) {
  const n = Math.max(d.members, 1);
  return (
    <div className="story-hud mono" aria-live="polite">
      <span className={`hud-lamp${d.weakened ? " on" : ""}`} aria-hidden="true" />
      <span className="hud-keys" aria-label={`${d.threshold} of ${d.members} keys`}>
        {Array.from({ length: Math.min(n, 15) }, (_, i) => (
          <i key={i} className={i < d.threshold ? "on" : ""} />
        ))}
      </span>
      <b>{d.threshold}/{d.members}</b>
      <span className={d.timelockSeconds === 0 ? "hud-weak" : ""}>{timelockText(d)}</span>
    </div>
  );
}

export default function HomeStory({ beats, compact = false, label = "How Drift lost control, step by step" }: { beats: Beat[]; compact?: boolean; label?: string }) {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const els = refs.current.filter(Boolean) as HTMLDivElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.beat));
        }
      },
      // A beat is active while it crosses the middle band of the viewport.
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const current = beats[Math.min(active, beats.length - 1)]!;
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    setPhone(mq.matches);
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  return (
    <section className={`story${compact ? " compact" : ""}`} aria-label={label}>
      <StoryHud d={current.device} />
      <div className="story-beats">
        {beats.map((b, i) => (
          <div
            key={b.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-beat={i}
            className={`story-beat${i === active ? " on" : ""}${i === 0 && !compact ? " first" : ""}`}
          >
            {b.body}
          </div>
        ))}
      </div>
      {!(compact && phone) && <div className="story-device">
        <div className="device-frame">
          {/* On a phone the 3D console shows once, in beat 0's state; the HUD tells the story. */}
          <ConsoleDevice data={phone ? beats[0]!.device : current.device} />
        </div>
        <ol className="story-progress mono" aria-hidden="true">
          {beats.map((b, i) => (
            <li key={b.id} className={i === active ? "on" : i < active ? "done" : ""} />
          ))}
        </ol>
      </div>}
    </section>
  );
}
