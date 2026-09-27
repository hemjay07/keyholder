// A protocol's control history as lanes on one time axis, the replay's grammar
// (design/REVAMP-PAGES.md): upgrades on one lane, authority and multisig changes
// on the other, a now-line at today. Every tick is a real transaction.
import Link from "next/link";

export interface LaneChange {
  uid: string;
  blockTime: string;
  signature: string;
  kind: string;
}

const LANES = [
  { key: "upgrade", label: "Program upgrades", match: (k: string) => k === "upgrade" },
  { key: "authority", label: "Authority and keys", match: (k: string) => k !== "upgrade" },
];

function monthTicks(t0: number, t1: number): Array<{ t: number; label: string }> {
  const out: Array<{ t: number; label: string }> = [];
  const d = new Date(t0);
  d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); d.setUTCMonth(d.getUTCMonth() + 1);
  while (d.getTime() < t1) {
    out.push({ t: d.getTime(), label: `${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} ’${String(d.getUTCFullYear()).slice(2)}` });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out.length > 8 ? out.filter((_, i) => i % Math.ceil(out.length / 8) === 0) : out;
}

export default function ProtocolLanes({ changes, highlight, now }: { changes: LaneChange[]; highlight?: string; now: string }) {
  if (changes.length === 0) return null;
  const times = changes.map((c) => Date.parse(c.blockTime));
  const t1 = Date.parse(now);
  const span = Math.max(t1 - Math.min(...times), 86_400_000);
  const t0 = Math.min(...times) - span * 0.04;
  const x = (t: number) => ((t - t0) / (t1 - t0)) * 100;
  return (
    <div className="plane" role="group" aria-label="Control history">
      <div className="plane-axis mono">
        {monthTicks(t0, t1).filter((m) => x(m.t) < 90).map((m) => <span key={m.t} style={{ left: `${x(m.t)}%` }}>{m.label}</span>)}
        <span className="plane-today" style={{ left: "100%" }}>today</span>
      </div>
      {LANES.map((l) => (
        <div key={l.key} className="plane-lane">
          <span className="plane-label mono">{l.label}</span>
          <div className="plane-track">
            {changes.filter((c) => l.match(c.kind)).map((c) => (
              <Link
                key={c.uid}
                href={`/events/${encodeURIComponent(c.uid)}`}
                className={`plane-tick ${l.key}${c.uid === highlight ? " on" : ""}`}
                style={{ left: `${x(Date.parse(c.blockTime))}%` }}
                title={`${c.blockTime.slice(0, 16).replace("T", " ")} UTC · ${c.kind === "upgrade" ? "program upgraded" : c.kind === "set_authority" ? "upgrade authority changed" : "multisig settings changed"}`}
              />
            ))}
          </div>
        </div>
      ))}
      <span className="plane-now" />
    </div>
  );
}
