// The console for a protocol whose controlling authority could not be read. Same panel,
// same rows, but no number is shown that was not read: the key slots are blank and marked
// unknown, and the readout says why.
export default function UnresolvedConsole({ name, note }: { name: string; note: string }) {
  return (
    <div data-device="console-unresolved" className="console-fallback cf-unresolved" role="img" aria-label={`${name} console: control unresolved. ${note}`}>
      <div className="cf-row cf-name">
        <span>{name.toUpperCase()}</span>
        <span>UNRESOLVED</span>
      </div>
      <div className="cf-row cf-keys">
        <span className="cf-label">KEYS</span>
        <div className="cf-slots">
          {Array.from({ length: 1 }, (_, i) => <span key={i} className="cf-slot unknown">?</span>)}
        </div>
        <span className="cf-value">not read</span>
      </div>
      <div className="cf-row cf-time">
        <span className="cf-label">TIME</span>
        <span className="cf-value">not read</span>
      </div>
      <div className="cf-row cf-code">
        <span className="cf-label">CODE</span>
        <span className="cf-dim">not read</span>
      </div>
      <div className="cf-row cf-last">
        <span className="cf-label">LAST</span>
        <span className="cf-readout">{note}</span>
      </div>
    </div>
  );
}
