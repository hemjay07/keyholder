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

export default function HomeStory({ beats }: { beats: Beat[] }) {
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

  return (
    <section className="story" aria-label="How Drift lost control, step by step">
      <div className="story-beats">
        {beats.map((b, i) => (
          <div
            key={b.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-beat={i}
            className={`story-beat${i === active ? " on" : ""}${i === 0 ? " first" : ""}`}
          >
            {b.body}
          </div>
        ))}
      </div>
      <div className="story-device">
        <div className="device-frame">
          <ConsoleDevice data={current.device} />
        </div>
        <ol className="story-progress mono" aria-hidden="true">
          {beats.map((b, i) => (
            <li key={b.id} className={i === active ? "on" : i < active ? "done" : ""} />
          ))}
        </ol>
      </div>
    </section>
  );
}
