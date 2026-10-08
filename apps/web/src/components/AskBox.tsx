'use client';
// File: apps/web/src/components/AskBox.tsx
// Ask Keyholder (POST /api/v1/ask). The answer is shown with the record reads it was built from, so every claim
// can be traced to the program, key or day it came from. Errors say what happened in plain words.
import { useState, type FormEvent } from 'react';
import s from './askbox.module.css';

interface AskData { answer: string; toolCalls: { name: string; input: unknown }[] }
type State = { kind: 'idle' } | { kind: 'busy'; q: string } | { kind: 'done'; q: string; data: AskData } | { kind: 'error'; q: string; message: string };

const EXAMPLES = ['Who can upgrade Kamino Lend?', 'Open votes on Jupiter Perps', 'Which keys sign for the most money?'];
const ERRORS: Record<string, string> = {
  RATE_LIMITED: 'Too many questions from here in a minute. Try again shortly.',
  MODEL_BUSY: 'The model is busy. Try again in a moment.',
  MODEL_ERROR: 'The model could not answer right now.',
  BAD_QUESTION: 'Ask a question of up to 600 characters.',
};

/** One line per record read, e.g. "get_program KLend2g3…YavgmjD". */
function readLabel(t: { name: string; input: unknown }): string {
  const v = t.input && typeof t.input === 'object' ? Object.values(t.input as Record<string, unknown>).find((x) => typeof x === 'string') : undefined;
  const arg = typeof v === 'string' ? (v.length > 24 ? `${v.slice(0, 8)}…${v.slice(-6)}` : v) : '';
  return `${t.name.replace(/_/g, ' ')}${arg ? ` · ${arg}` : ''}`;
}

export default function AskBox() {
  const [q, setQ] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function submit(e?: FormEvent, text = q) {
    e?.preventDefault();
    const question = text.trim();
    if (!question || state.kind === 'busy') return;
    setState({ kind: 'busy', q: question });
    try {
      const r = await fetch('/api/v1/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question }) });
      const j = (await r.json()) as { data: AskData | null; error: { code: string } | null };
      if (!r.ok || !j.data) throw new Error(ERRORS[j.error?.code ?? ''] ?? 'Something went wrong reading the record.');
      setState({ kind: 'done', q: question, data: j.data });
    } catch (err) {
      setState({ kind: 'error', q: question, message: err instanceof Error ? err.message : 'Something went wrong.' });
    }
  }

  return (
    <form className={s.ask} onSubmit={submit} aria-busy={state.kind === 'busy'}>
      <label htmlFor="ask-q">Ask Keyholder</label>
      <div className={s.row}>
        <input id="ask-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Program, key or question" autoComplete="off" maxLength={600} />
        <button type="submit" disabled={state.kind === 'busy'}>{state.kind === 'busy' ? 'Reading…' : 'Ask'}</button>
      </div>
      {state.kind === 'idle' && (
        <div className={s.eg}>
          {EXAMPLES.map((x) => <button key={x} type="button" onClick={() => { setQ(x); void submit(undefined, x); }}>{x}</button>)}
        </div>
      )}
      {state.kind === 'busy' && <p className={s.busy}><i />Reading the record for “{state.q}”</p>}
      {state.kind === 'error' && <p className={s.err}>{state.message}</p>}
      {state.kind === 'done' && (
        <div className={s.answer}>
          {state.data.answer.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
          {state.data.toolCalls.length > 0 && (
            <div className={s.reads}><span>Read from the record</span>{state.data.toolCalls.map((t, i) => <code key={i}>{readLabel(t)}</code>)}</div>
          )}
        </div>
      )}
      <p className={s.note}>Ask in plain words; every answer cites the program, key or transaction it came from.</p>
    </form>
  );
}
