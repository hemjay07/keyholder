// Share cards (1200x630) for every route: the mark, a headline, and a flat
// console strip (keys, timelock, lamp) drawn from real data. Satori renders
// flexbox JSX only, so the 3D console is drawn as its 2D reading.
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

const INK = "#1B1A17";
const GROUND = "#E6E2D9";
const INK2 = "#5A564E";
const SIG = "#FF5A1F";
const SIG_TEXT = "#A32F06";

async function fonts() {
  const dir = join(process.cwd(), "src", "lib", "og");
  const [sans, mono] = await Promise.all([readFile(join(dir, "Geist-Regular.ttf")), readFile(join(dir, "GeistMono-Regular.ttf"))]);
  return [
    { name: "Geist", data: sans, weight: 400 as const, style: "normal" as const },
    { name: "Geist Mono", data: mono, weight: 400 as const, style: "normal" as const },
  ];
}

function Mark({ scale = 1 }: { scale?: number }) {
  const s = (n: number) => n * scale;
  const bar = (turned: boolean, key: number) => (
    <div key={key} style={{ width: s(turned ? 28 : 14), height: s(turned ? 14 : 44), borderRadius: s(7), background: INK, marginRight: s(turned ? 6 : 14) }} />
  );
  return (
    <div style={{ display: "flex", alignItems: "center", border: `${s(6)}px solid ${INK}`, borderRadius: s(16), padding: `${s(10)}px ${s(16)}px`, height: s(80) }}>
      {bar(true, 0)}
      {bar(true, 1)}
      <div style={{ width: s(10) }} />
      {bar(false, 2)}
      {bar(false, 3)}
      {bar(false, 4)}
      <div style={{ width: s(18), height: s(18), borderRadius: s(9), background: SIG }} />
    </div>
  );
}

export interface CardState {
  threshold: number;
  members: number;
  timelock: string; // "none", "1 h", "no timelock feature", …
  weak: boolean;
}

export async function card(opts: { kicker: string; headline: string; sub?: string; state?: CardState | null }) {
  const { kicker, headline, sub, state } = opts;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: GROUND, padding: "56px 64px", fontFamily: "Geist", color: INK }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Mark scale={0.62} />
            <div style={{ fontSize: 30, letterSpacing: 6, marginLeft: 22 }}>KEYHOLDER</div>
          </div>
          <div style={{ fontFamily: "Geist Mono", fontSize: 20, letterSpacing: 3, color: SIG_TEXT }}>{kicker.toUpperCase()}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: headline.length > 44 ? 58 : 72, lineHeight: 1.05, letterSpacing: -1, maxWidth: 1060 }}>{headline}</div>
          {sub && <div style={{ fontSize: 28, color: INK2, marginTop: 18, maxWidth: 1000 }}>{sub}</div>}
        </div>
        {state ? (
          <div style={{ display: "flex", alignItems: "center", borderTop: `3px solid ${INK}`, paddingTop: 22, fontFamily: "Geist Mono", fontSize: 26 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: state.weak ? SIG : "#C9C3B6", marginRight: 22 }} />
            <div style={{ display: "flex", marginRight: 22 }}>
              {Array.from({ length: Math.min(state.members, 15) }, (_, i) => (
                <div key={i} style={{ width: 18, height: 18, borderRadius: 9, marginRight: 6, background: i < state.threshold ? INK : "transparent", border: `2px solid ${INK}` }} />
              ))}
            </div>
            <div style={{ marginRight: 30 }}>{`${state.threshold} of ${state.members} keys`}</div>
            <div style={{ color: state.weak ? SIG_TEXT : INK }}>{state.timelock === "none" ? "no timelock" : state.timelock.startsWith("no ") ? state.timelock : `timelock ${state.timelock}`}</div>
          </div>
        ) : (
          <div style={{ display: "flex", borderTop: `3px solid ${INK}`, paddingTop: 22, fontFamily: "Geist Mono", fontSize: 24, letterSpacing: 3, color: INK2 }}>COUNT THE KEYS.</div>
        )}
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() }
  );
}
