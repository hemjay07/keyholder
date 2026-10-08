'use client';
// File: apps/web/src/components/ClaimCheck.tsx
// Paste a signed claim, get the verdict against today's record (POST /api/v1/claims; nothing is stored).
import { useState } from 'react';
import s from './claimcheck.module.css';

interface Result { protocol: string; day: string; status: 'holds' | 'broken' | 'invalid'; reasons: string[]; breaks: { programId: string; path: string; expected: string; actual: string }[] }
const short = (k: string) => (k.length > 20 ? `${k.slice(0, 4)}…${k.slice(-4)}` : k);

export default function ClaimCheck({ example }: { example: string }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function run() {
    setBusy(true); setErr(null); setRes(null);
    try {
      const claim = JSON.parse(text);
      const r = await fetch('/api/v1/claims', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claim }) });
      const j = (await r.json()) as { data: Result | null; error: { message?: string; code: string } | null };
      if (!j.data) throw new Error(j.error?.message ?? j.error?.code ?? 'Could not check this claim.');
      setRes(j.data);
    } catch (e) { setErr(e instanceof SyntaxError ? 'That is not valid JSON.' : e instanceof Error ? e.message : 'Could not check this claim.'); }
    finally { setBusy(false); }
  }
  return (
    <div className={s.box}>
      <label htmlFor="claim">Paste a signed claim</label>
      <textarea id="claim" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} placeholder={example} rows={10} />
      <div className={s.row}>
        <button onClick={run} disabled={busy || !text.trim()}>{busy ? 'Checking…' : 'Check against today’s record'}</button>
        <button className={s.ghost} onClick={() => setText(example)}>Load the example</button>
      </div>
      {err && <p className={s.err}>{err}</p>}
      {res && (
        <div className={`${s.res} ${s[res.status]}`}>
          <b>{res.status === 'holds' ? 'Holds' : res.status === 'broken' ? 'Broken' : 'Not a valid claim'}</b>
          <span>{res.protocol} · record of {res.day}</span>
          {res.reasons.map((r) => <p key={r}>{r.replace(/[1-9A-HJ-NP-Za-km-z]{32,44}/g, short)}</p>)}
          {res.breaks.map((b, i) => <p key={i}>{short(b.programId)} {b.path}: promised {b.expected}, chain shows {b.actual}</p>)}
          {res.status === 'holds' && <p>The chain matches every promise in this claim today.</p>}
        </div>
      )}
    </div>
  );
}
