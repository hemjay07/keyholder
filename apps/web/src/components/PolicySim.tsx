"use client";
// The /policy simulator: set a vault's policy and see, for each tracked
// protocol's control read today, what the deployed check program would answer.
// Mirrors programs/keyholder/src/lib.rs `check`: immutable programs pass the
// threshold and timelock tests; Squads v4, Squads v3 and coral multisigs are
// compared to the policy (v3 and coral have no timelock); any other control
// type is refused as UNKNOWN_AUTHORITY.
import { useMemo, useState } from "react";
import Link from "next/link";

export interface SimProtocol {
  id: string;
  name: string;
  kind: "immutable" | "multisig" | "other";
  otherLabel?: string;
  threshold: number | null;
  members: number | null;
  timelockS: number | null;
}

const TIMELOCKS = [
  { s: 0, label: "none" },
  { s: 3600, label: "1 h" },
  { s: 86400, label: "24 h" },
  { s: 172800, label: "48 h" },
];

function decide(p: SimProtocol, minThreshold: number, minTimelock: number): { ok: boolean; why: string } {
  if (p.kind === "immutable") return { ok: true, why: "no upgrade key" };
  if (p.kind === "other") return { ok: false, why: `unknown authority: ${p.otherLabel ?? "control type"} is not read on-chain yet` };
  const reasons: string[] = [];
  if ((p.threshold ?? 0) < minThreshold) reasons.push(`threshold ${p.threshold} < ${minThreshold}`);
  if ((p.timelockS ?? 0) < minTimelock) reasons.push(`timelock ${fmt(p.timelockS ?? 0)} < ${fmt(minTimelock)}`);
  return reasons.length ? { ok: false, why: reasons.join(" · ") } : { ok: true, why: "meets policy" };
}

function fmt(s: number): string {
  if (s === 0) return "none";
  if (s % 86400 === 0) return `${s / 86400} d`;
  if (s % 3600 === 0) return `${s / 3600} h`;
  return `${s} s`;
}

export default function PolicySim({ protocols }: { protocols: SimProtocol[] }) {
  const [minThreshold, setMinThreshold] = useState(3);
  const [minTimelock, setMinTimelock] = useState(86400);

  const rows = useMemo(
    () => protocols.map((p) => ({ p, d: decide(p, minThreshold, minTimelock) })).sort((a, b) => Number(b.d.ok) - Number(a.d.ok) || a.p.name.localeCompare(b.p.name)),
    [protocols, minThreshold, minTimelock]
  );
  const passing = rows.filter((r) => r.d.ok).length;

  return (
    <div className="sim">
      <div className="sim-controls">
        <label className="mono">
          Minimum keys to sign <b>{minThreshold}</b>
          <input type="range" min={1} max={8} step={1} value={minThreshold} onChange={(e) => setMinThreshold(Number(e.target.value))} />
        </label>
        <fieldset>
          <legend className="mono">Minimum timelock</legend>
          <div className="sim-seg">
            {TIMELOCKS.map((t) => (
              <button key={t.s} type="button" className={t.s === minTimelock ? "on" : ""} onClick={() => setMinTimelock(t.s)} aria-pressed={t.s === minTimelock}>
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="sim-gate" data-device="policy-gate" role="img" aria-label={`${passing} of ${protocols.length} protocols pass`}>
        {rows.map(({ p, d }, i) => (
          <span key={p.id} className={`gate-cell ${d.ok ? "pass" : "refuse"}`} style={{ animationDelay: `${i * 40}ms` }} title={`${p.name}: ${d.ok ? "pass" : "refuse"}`} />
        ))}
      </div>

      <p className="sim-result">
        <b className={passing === 0 ? "weak" : ""}>{passing} of {protocols.length}</b> protocols would pass this policy today. The rest would be refused on-chain.
      </p>

      <ol className="sim-rows">
        {rows.map(({ p, d }) => (
          <li key={p.id} className={d.ok ? "pass" : "refuse"}>
            <span className="sim-verdict mono">{d.ok ? "pass" : "refuse"}</span>
            <Link href={`/protocols/${p.id}`} className="sim-name">{p.name}</Link>
            <span className="sim-why mono">{d.why}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
