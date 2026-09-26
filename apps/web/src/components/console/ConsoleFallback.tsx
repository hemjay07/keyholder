// Static, non-WebGL render of the same control facts. Used under reduced motion, when
// WebGL is unavailable, and as the frame the 3D canvas mounts into (so layout never shifts).
import type { ConsoleData } from "./Console";

function timelockText(data: ConsoleData): string {
  if (data.noTimelockFeature) return "no timelock feature";
  if (data.timelockSeconds === 0) return "none";
  if (data.timelockSeconds % 86400 === 0) return `${data.timelockSeconds / 86400} d`;
  return `${+(data.timelockSeconds / 3600).toFixed(1)} h`;
}

export default function ConsoleFallback({ data }: { data: ConsoleData }) {
  const slots = Array.from({ length: Math.max(data.members, 1) }, (_, i) => i < data.threshold);
  return (
    <div className="console-fallback" role="img" aria-label={`${data.protocol} console: ${data.threshold} of ${data.members} keys required, timelock ${timelockText(data)}, ${data.verified ? "verified" : "not verified"}, ${data.weakened ? "weakened" : "nominal"}. ${data.label}`}>
      <div className="cf-row cf-name">
        <span>{data.protocol}</span>
        <span className={data.weakened ? "cf-weak" : "cf-nominal"}>{data.weakened ? "WEAKENED" : "NOMINAL"}</span>
      </div>
      <div className="cf-row cf-keys">
        <span className="cf-label">KEYS</span>
        <div className="cf-slots">
          {slots.map((turned, i) => (
            <span key={i} className={turned ? "cf-slot on" : "cf-slot"} />
          ))}
        </div>
        <span className="cf-value">{data.threshold} of {data.members} required</span>
      </div>
      <div className="cf-row cf-time">
        <span className="cf-label">TIME</span>
        <span className="cf-value">{timelockText(data)}</span>
      </div>
      <div className="cf-row cf-code">
        <span className="cf-label">CODE</span>
        <span className={data.verified ? "cf-nominal" : "cf-dim"}>{data.verified ? "verified" : "not verified"}</span>
        <span className={data.codeDrifted ? "cf-weak" : "cf-dim"}>{data.codeDrifted ? "drifted" : "no drift record"}</span>
      </div>
      <div className="cf-row cf-last">
        <span className="cf-label">LAST</span>
        <span className="cf-readout">{data.label}</span>
      </div>
    </div>
  );
}
