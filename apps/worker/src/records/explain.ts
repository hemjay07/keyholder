// File: apps/worker/src/records/explain.ts
// Plain-language explanation of one pending multisig transaction, from its decoded facts only.
// One call per transaction, cached in pending_action.explanation; the facts are the source of truth.

import Anthropic from '@anthropic-ai/sdk';
import type { PendingTx } from './pending';

export const EXPLAIN_MODEL = 'claude-opus-5-5';

const SYSTEM = `You explain a pending Solana multisig transaction to someone who holds money in the programs it controls.
Write two or three plain sentences:
1. What the transaction would do if executed (each action, with the exact addresses given).
2. Its state: votes so far against the threshold, whether it is waiting for votes or approved and waiting to be executed, its age, and the timelock.
3. Why it matters for the programs listed (for example, an upgrade replaces program code; a lower threshold means fewer keys can act).
Use only the facts given. Do not guess intent, owners, or token names. If an action is an unknown call, say only which program it calls.`;

export interface ExplainContext { threshold: number | null; timelockS: number | null; controls: { programId: string; path: string }[]; now: number }

export function factsFor(t: PendingTx, ctx: ExplainContext): string {
  const ageDays = t.statusAt ? Math.floor((ctx.now - t.statusAt) / 86400) : null;
  return JSON.stringify({
    multisig: t.multisig, transaction: t.address, index: t.index, kind: t.kind,
    status: t.status, statusDaysAgo: ageDays, approvals: t.approvals.length, threshold: ctx.threshold, timelockSeconds: ctx.timelockS,
    controls: ctx.controls, actions: t.actions,
  });
}

/** Returns the explanation text, or null when the model declined. */
export async function explainPending(client: Anthropic, t: PendingTx, ctx: ExplainContext): Promise<string | null> {
  const response = await client.beta.messages.create({
    model: EXPLAIN_MODEL,
    max_tokens: 2048,
    output_config: { effort: 'low' },
    // Refusal fallback on by default (Claude API guidance); routed by refusal category.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{ role: 'user', content: factsFor(t, ctx) }],
  });
  if (response.stop_reason === 'refusal') return null;
  const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
  return text || null;
}
