// The feed's device: every control change over the window as a tick on one
// strip, one column per UTC day. Tick height is that day's count; the orange
// part is changes by protocols with no timelock. Server-rendered SVG; the
// strip draws in once from the left (CSS, 1.4 s, off under reduced motion).

export interface SeismoDay {
  day: string; // YYYY-MM-DD
  weak: number;
  other: number;
}

export default function Seismograph({ days, from, to }: { days: SeismoDay[]; from: string; to: string }) {
  const W = 1000;
  const H = 140;
  const base = H - 4;
  const byDay = new Map(days.map((d) => [d.day, d]));
  const cols: Array<{ x: number; d: SeismoDay; label: string | null }> = [];
  const start = new Date(from + "T00:00:00Z").getTime();
  const end = new Date(to + "T00:00:00Z").getTime();
  const n = Math.round((end - start) / 86400000) + 1;
  const max = Math.max(1, ...days.map((d) => d.weak + d.other));
  for (let i = 0; i < n; i++) {
    const t = new Date(start + i * 86400000);
    const key = t.toISOString().slice(0, 10);
    const label = t.getUTCDate() === 1 ? t.toLocaleString("en-GB", { month: "short", timeZone: "UTC" }) : null;
    cols.push({ x: (i + 0.5) * (W / n), d: byDay.get(key) ?? { day: key, weak: 0, other: 0 }, label });
  }
  const unit = (base - 14) / max;
  const total = days.reduce((s, d) => s + d.weak + d.other, 0);

  return (
    <figure className="seismo" data-device="seismograph">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${total} control changes from ${from} to ${to}, one tick per day`}>
        <line x1="0" x2={W} y1={base} y2={base} className="seismo-base" />
        <g className="seismo-ticks">
          {cols.map((c) =>
            c.d.weak + c.d.other === 0 ? (
              <line key={c.d.day} x1={c.x} x2={c.x} y1={base} y2={base - 2} className="seismo-idle" />
            ) : (
              <g key={c.d.day}>
                <line x1={c.x} x2={c.x} y1={base} y2={base - c.d.other * unit} className="seismo-other" />
                {c.d.weak > 0 && (
                  <line x1={c.x} x2={c.x} y1={base - c.d.other * unit} y2={base - (c.d.other + c.d.weak) * unit} className="seismo-weak" />
                )}
              </g>
            )
          )}
        </g>
      </svg>
      {/* Month labels in HTML: text inside a stretched SVG distorts at narrow widths. */}
      <div className="seismo-months mono" aria-hidden="true">
        {cols.filter((c) => c.label).map((c) => (
          <span key={`l-${c.d.day}`} style={{ left: `${(c.x / W) * 100}%` }}>{c.label}</span>
        ))}
      </div>
      <figcaption className="mono">
        <span><i className="sw weak" /> no timelock</span>
        <span><i className="sw other" /> with timelock or unresolved</span>
        <span>{from} → {to} · one tick per day · tallest day {max}</span>
      </figcaption>
    </figure>
  );
}
