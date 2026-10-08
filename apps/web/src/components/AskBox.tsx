'use client';
// File: apps/web/src/components/AskBox.tsx
// Ask Keyholder v2 (design/ASK-PLAN.md). Names and addresses answer at once from the record; questions stream their
// record reads, then a structured answer: verdict, control cards, facts, sources, follow-ups. Answers drive the Stage
// map (kh-pick event). Follow-ups keep the thread; ?ask= in the URL replays a question.
import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { ProgramCard, Resolved, SignerCard } from '@/lib/ask-resolve';
import { formatUsd } from './stagemap/format';
import s from './askbox.module.css';

interface Fact { label: string; value: string; tone?: 'weak' | 'holds' | 'plain' }
interface Answer { verdict: string; facts: Fact[]; programIds: string[]; signerKeys?: string[]; followups: string[] }
interface Turn { q: string; steps: string[]; answer?: Answer; text?: string; cards?: ProgramCard[]; resolved?: Resolved; error?: string; done: boolean; ms?: number }

const EXAMPLES = ['Kamino Lend', 'Which Stage 0 programs hold the most money?', 'Which keys sign for the most money?'];
const ERRORS: Record<string, string> = {
  RATE_LIMITED: 'Too many questions from here in a minute. Try again shortly.',
  MODEL_BUSY: 'The model is busy. Ask about a program by name or address; those answer instantly.',
  MODEL_ERROR: 'The model could not answer right now. Names and addresses still answer instantly.',
  MODEL_OFFLINE: 'Written answers are paused right now. Program names, program ids and signer keys still answer instantly from the record.',
  SERVER_ERROR: 'Something went wrong reading the record.',
  DECLINED: 'That question was declined. Ask about a program, a signer, a stage or recent changes.',
  NO_ANSWER: 'No answer came back. Try asking more specifically.',
};
const ADDR = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const short = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;
const delay = (t: number | null) => (!t ? 'no delay' : t < 3600 ? `${Math.round(t / 60)} min` : `${Math.round(t / 3600)} h`);
const toneOf = (t: number | null) => (!t ? s.weak : t >= 86400 ? s.holds : '');
const stageTone = (n: number | null) => (n == null ? '' : n === 0 ? s.weak : n >= 2 ? s.holds : '');

/** Text with every address shortened and linked (programs and signers resolve on their own pages). */
function Linked({ text, programs }: { text: string; programs: Set<string> }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(ADDR)) {
    parts.push(text.slice(last, m.index));
    const a = m[0];
    parts.push(<Link key={`${a}${m.index}`} className={s.addr} href={programs.has(a) ? `/programs/${a}` : `/signers/${a}`} title={a}>{short(a)}</Link>);
    last = (m.index ?? 0) + a.length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

function Card({ c }: { c: ProgramCard }) {
  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <Link href={`/programs/${c.id}`} className={s.cardName}>{c.name}</Link>
        <b className={stageTone(c.stage)}>Stage {c.stage}</b>
        <span>{c.usd ? `${formatUsd(c.usd)} traced` : 'no dollars traced'}</span>
      </div>
      <ul className={s.paths}>
        {c.paths.map((p) => (
          <li key={p.label} className={p.binding ? s.binding : ''}>
            <span>{p.label}{p.binding ? ' · sets the stage' : ''}</span>
            <span>{p.threshold != null ? `${p.threshold} of ${p.members}` : p.kind.replace(/_/g, ' ')}</span>
            <span className={p.threshold != null ? toneOf(p.timelockS) : s.weak}>{p.threshold != null ? delay(p.timelockS) : 'one key'}</span>
          </li>
        ))}
      </ul>
      <div className={s.cardFoot}>
        <button type="button" onClick={() => dispatchEvent(new CustomEvent('kh-pick', { detail: c.id }))}>See it on the map ↓</button>
        <Link href={`/programs/${c.id}`}>Full record →</Link>
      </div>
    </div>
  );
}

function SignerResult({ k }: { k: SignerCard }) {
  return (
    <div className={s.card}>
      <div className={s.cardHead}><Link href={`/signers/${k.key}`} className={s.cardName}>Key {short(k.key)}</Link><b>{k.multisigs} multisig{k.multisigs === 1 ? '' : 's'}</b><span>{k.usd ? `${formatUsd(k.usd)} behind it` : ''}</span></div>
      {k.aloneOn > 0 && <p className={s.weak}>Can act alone on {k.aloneOn} multisig{k.aloneOn === 1 ? '' : 's'}.</p>}
      <ul className={s.paths}>{k.programs.slice(0, 6).map((p) => <li key={p.id}><Link href={`/programs/${p.id}`}>{p.name}</Link><span className={stageTone(p.stage)}>Stage {p.stage}</span><span>{p.usd ? formatUsd(p.usd) : ''}</span></li>)}</ul>
      <div className={s.cardFoot}><Link href={`/signers/${k.key}`}>Every program it signs for →</Link></div>
    </div>
  );
}

function verdictFor(r: Resolved): string {
  if (r.program) {
    const p = r.program, b = p.paths.find((x) => x.binding);
    return `${p.name} is Stage ${p.stage}: ${b ? `its ${b.label.toLowerCase()} path needs ${b.threshold != null ? `${b.threshold} of ${b.members} keys with ${delay(b.timelockS)}` : 'one key'}` : 'see its control paths'}.`;
  }
  const k = r.signer!;
  return `This key sits on ${k.multisigs} multisig${k.multisigs === 1 ? '' : 's'} that can help change ${k.programs.length} program${k.programs.length === 1 ? '' : 's'}${k.usd ? ` holding ${formatUsd(k.usd)}` : ''}.`;
}

export default function AskBox() {
  const [q, setQ] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const busy = turns.some((t) => !t.done);
  const end = useRef<HTMLDivElement>(null);
  const update = (i: number, patch: Partial<Turn> | ((t: Turn) => Partial<Turn>)) => setTurns((ts) => ts.map((t, j) => (j === i ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) } : t)));

  async function ask(text: string, fresh = false) {
    const question = text.trim();
    if (!question || busy) return;
    const prior = fresh ? [] : turns;
    const history = prior.filter((t) => t.answer || t.text).map((t) => ({ q: t.q, a: t.answer?.verdict ?? t.text ?? '' }));
    const i = prior.length, t0 = performance.now();
    setTurns([...prior, { q: question, steps: [], done: false }]);
    setQ('');
    const url = new URL(location.href); url.searchParams.set('ask', question); history.length || replaceState(url);
    try {
      const r = await fetch('/api/v1/ask/stream', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, history }) });
      if (!r.ok || !r.body) { const j = (await r.json().catch(() => null)) as { error?: { code?: string } } | null; throw new Error(j?.error?.code ?? 'SERVER_ERROR'); }
      const reader = r.body.getReader(), dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const chunks = buf.split('\n\n'); buf = chunks.pop() ?? '';
        for (const c of chunks) {
          if (!c.startsWith('data: ')) continue;
          const e = JSON.parse(c.slice(6)) as { type: string; [k: string]: unknown };
          if (e.type === 'step') update(i, (t) => ({ steps: [...t.steps, String(e.label)] }));
          else if (e.type === 'instant') { const res = e.resolved as Resolved; update(i, { resolved: res }); if (res.program) dispatchEvent(new CustomEvent('kh-pick', { detail: res.program.id })); }
          else if (e.type === 'answer') update(i, { answer: e.answer as Answer });
          else if (e.type === 'cards') { const cards = e.cards as ProgramCard[]; update(i, { cards }); if (cards[0]) dispatchEvent(new CustomEvent('kh-pick', { detail: cards[0].id })); }
          else if (e.type === 'text') update(i, { text: String(e.text) });
          else if (e.type === 'error') update(i, { error: ERRORS[String(e.code)] ?? ERRORS.SERVER_ERROR });
        }
      }
    } catch (err) {
      update(i, { error: ERRORS[err instanceof Error ? err.message : ''] ?? ERRORS.SERVER_ERROR });
    } finally {
      update(i, { done: true, ms: Math.round(performance.now() - t0) });
    }
  }

  // ?ask= replays a shared question once on load.
  useEffect(() => { const a = new URLSearchParams(location.search).get('ask'); if (a) void ask(a, true); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [turns.length]);

  const submit = (e: FormEvent) => { e.preventDefault(); void ask(q); };
  return (
    <div className={s.ask}>
      <form onSubmit={submit} aria-busy={busy}>
        <label htmlFor="ask-q">Ask Keyholder</label>
        <div className={s.row}>
          <input id="ask-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={turns.length ? 'Ask a follow-up' : 'Program, key or question'} autoComplete="off" maxLength={600} />
          <button type="submit" disabled={busy || !q.trim()}>{busy ? 'Reading…' : 'Ask'}</button>
        </div>
      </form>
      {!turns.length && <div className={s.eg}>{EXAMPLES.map((x) => <button key={x} type="button" onClick={() => void ask(x, true)}>{x}</button>)}</div>}
      <div className={s.thread} aria-live="polite">
        {turns.map((t, i) => {
          const ids = new Set([...(t.cards ?? []).map((c) => c.id), ...(t.answer?.programIds ?? [])]);
          return (
            <section key={i} className={s.turn}>
              <p className={s.q}>{t.q}</p>
              {!t.done && !t.answer && !t.resolved && (
                <ol className={s.steps}>{(t.steps.length ? t.steps : ['Reading the record']).map((st, j, a) => <li key={j} className={j === a.length - 1 ? s.live : ''}>{st}</li>)}</ol>
              )}
              {t.resolved && (<><p className={s.verdict}>{verdictFor(t.resolved)}</p>{t.resolved.program && <Card c={t.resolved.program} />}{t.resolved.signer && <SignerResult k={t.resolved.signer} />}</>)}
              {t.answer && (
                <>
                  <p className={s.verdict}><Linked text={t.answer.verdict} programs={ids} /></p>
                  {t.answer.facts.length > 0 && <dl className={s.facts}>{t.answer.facts.map((f, j) => <div key={j}><dt>{f.label}</dt><dd className={f.tone === 'weak' ? s.weak : f.tone === 'holds' ? s.holds : ''}><Linked text={f.value} programs={ids} /></dd></div>)}</dl>}
                  {(t.cards ?? []).map((c) => <Card key={c.id} c={c} />)}
                </>
              )}
              {t.text && <p className={s.verdict}><Linked text={t.text} programs={ids} /></p>}
              {t.error && <p className={s.err}>{t.error}</p>}
              {t.done && (t.steps.length > 0 || t.resolved) && <p className={s.src}>{t.resolved ? 'Read straight from the record' : `Read from the record: ${t.steps.join(' · ')}`}{t.ms != null ? ` · ${(t.ms / 1000).toFixed(1)} s` : ''}</p>}
              {t.done && i === turns.length - 1 && t.answer?.followups.length ? <div className={s.eg}>{t.answer.followups.map((f) => <button key={f} type="button" onClick={() => void ask(f)}>{f}</button>)}</div> : null}
            </section>
          );
        })}
        <div ref={end} />
      </div>
      {turns.length > 0 && !busy && <button type="button" className={s.clear} onClick={() => { setTurns([]); const u = new URL(location.href); u.searchParams.delete('ask'); replaceState(u); }}>New question</button>}
      {!turns.length && <p className={s.note}>Names and addresses answer instantly. Every answer cites the program, key or transaction it came from.</p>}
    </div>
  );
}

const replaceState = (u: URL) => history.replaceState(null, '', u.toString());
