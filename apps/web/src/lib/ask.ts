// File: apps/web/src/lib/ask.ts
// Ask Keyholder: a question in plain language, answered by Claude using read-only tools over the
// Control Record (lib/records.ts). The model is never a source of facts: every number, key, program
// and transaction in an answer must come from a tool result, and the answer cites them.

import Anthropic from '@anthropic-ai/sdk';
import { PROGRAM_NAMES } from './program-names';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';
import { STAGE_RULES, RULES_VERSION } from '@keyholder/stages';
import { latestDay, registry, programRecord, stageHistory, signer, topSigners, changes } from './records';

// Ask is interactive (design/ASK-PLAN.md §3): Sonnet 5.5 at low effort. Haiku 4.5 was tried on 2026-10-08 and misread
// signer rows (called 10-of-10 multisig keys "single-key"), so it is not used. Opus stays for the offline pending-vote
// explanations (apps/worker/src/records/explain.ts).
export const ASK_MODEL = 'claude-sonnet-5-5';
export const MAX_QUESTION_CHARS = 600;
const MAX_TOOL_ROUNDS = 6;

const SYSTEM = `You answer questions about who can move money on Solana, using Keyholder's Control Record.
Rules:
- Use the tools for every fact. If the tools do not return it, say you do not have it. Never use outside knowledge for addresses, amounts, stages, signers or dates.
- Cite what you state: program ids, signer keys and transaction signatures exactly as the tools return them.
- Programs are named by id. A repo is "built from", never "owned by"; do not name a protocol as the owner unless a tool result says so.
- Stages are Control Stages ${RULES_VERSION}: 0 one key; 1 multisig with no 24 h delay somewhere (or admin fields not read); 2 every path a 2+ multisig with a 24 h+ delay; 3 immutable or 7 d+ delays.
- Dollar figures are floors from a vault census (liquid tokens only); say "at least".
- Finish by calling the answer tool exactly once, then stop. The verdict is one plain sentence a depositor understands. facts (at most 4, often none) are short label/value rows from tool results that the program cards do not already show (mark weak control with tone "weak", a 24 h+ delay or immutability with "holds"). programIds lists the covered programs the answer is about, most important first. followups are three short next questions.`;

const day = async () => {
  const d = await latestDay();
  if (!d) throw new Error('no record day built yet');
  return d;
};

const tools = [
  betaZodTool({
    name: 'search_programs',
    description: 'Find covered programs by name, stage, timelock and dollars traced, from the latest Control Record day. Names come from a short confirmed list (e.g. Kamino Lend, Jupiter Perps, Raydium AMM v4); most programs have no name, only an id. Returns at most `limit` rows, largest dollars first.',
    inputSchema: z.object({
      name: z.string().optional().describe('match a confirmed program name, case-insensitive substring'),
      maxStage: z.number().int().min(0).max(3).optional().describe('only programs at this stage or below'),
      minStage: z.number().int().min(0).max(3).optional(),
      noTimelock: z.boolean().optional().describe('only multisig upgrade paths with no timelock'),
      minUsd: z.number().optional().describe('only programs with at least this many dollars traced'),
      closed: z.boolean().optional().describe('only closed programs'),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    run: async (q) => {
      const d = await day();
      const want = q.name?.toLowerCase();
      const rows = (await registry(d))
        .map((r) => ({ ...r, name: PROGRAM_NAMES[r.programId] ?? null }))
        .filter((r) => !want || (r.name?.toLowerCase().includes(want) ?? false))
        .filter((r) => (q.maxStage == null || r.stage <= q.maxStage) && (q.minStage == null || r.stage >= q.minStage))
        .filter((r) => !q.noTimelock || (r.threshold != null && !r.timelockS))
        .filter((r) => q.minUsd == null || (r.usdFloor ?? 0) >= q.minUsd)
        .filter((r) => !q.closed || r.modifiers.includes('closed'))
        .sort((a, b) => (b.usdFloor ?? 0) - (a.usdFloor ?? 0));
      // Compact rows: only what an answer cites (smaller input, faster rounds).
      const out = rows.slice(0, q.limit ?? 10).map((r) => ({ programId: r.programId, name: r.name, stage: r.stage, usdFloor: r.usdFloor, setBy: r.binding, threshold: r.threshold, members: r.members, timelockS: r.timelockS }));
      return JSON.stringify({ day: d, matched: rows.length, rows: out });
    },
  }),
  betaZodTool({
    name: 'get_program',
    description: 'Full control record of one program: every control path and its verdict, the multisig (threshold, members, timelock), admin fields, dollars, contagion set, and its stage on every recorded day.',
    inputSchema: z.object({ programId: z.string().min(32).max(44) }),
    run: async ({ programId }) => {
      const d = await day();
      const record = await programRecord(programId, d);
      if (!record) return JSON.stringify({ error: 'not covered', programId });
      return JSON.stringify({ day: d, record, history: await stageHistory(programId) });
    },
  }),
  betaZodTool({
    name: 'get_signer',
    description: 'What one signer key can move: every multisig it sits in, the programs those control and through which path, dollars behind it. Use rank=true with no key for the keys with the most dollars behind them.',
    inputSchema: z.object({ key: z.string().min(32).max(44).optional(), rank: z.boolean().optional(), limit: z.number().int().min(1).max(25).optional() }),
    run: async ({ key, rank, limit }) => {
      const d = await day();
      if (rank || !key) return JSON.stringify({ day: d, signers: await topSigners(d, limit ?? 10) });
      const entry = await signer(key, d);
      return JSON.stringify(entry ? { day: d, signer: entry } : { error: 'not a signer of any covered multisig', key });
    },
  }),
  betaZodTool({
    name: 'get_changes',
    description: 'Control changes from the daily record diffs: program_closed, authority_changed, multisig_replaced, threshold_changed, timelock_changed, members_changed, admin_changed, stage_changed, claim_broken. Newest first.',
    inputSchema: z.object({
      since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      programId: z.string().min(32).max(44).optional(),
      kind: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    run: async (q) => JSON.stringify({ events: await changes({ since: q.since, programId: q.programId, kind: q.kind, limit: q.limit ?? 30 }) }),
  }),
  betaZodTool({
    name: 'get_stage_rules',
    description: 'The published Control Stage rules (version, thresholds, how a program moves up).',
    inputSchema: z.object({}),
    run: async () => JSON.stringify({ version: RULES_VERSION, rules: STAGE_RULES }),
  }),
];

/** The structured answer the model files at the end (design/ASK-PLAN.md §4). */
export const AnswerSchema = z.object({
  verdict: z.string().min(1).max(260).describe('one plain sentence, under 35 words'),
  facts: z.array(z.object({ label: z.string().max(40), value: z.string().max(80), tone: z.enum(['weak', 'holds', 'plain']).optional() })).max(4).describe('only facts the program cards do not already show (cards render each program\'s stage, paths, thresholds and delays from the record)'),
  programIds: z.array(z.string().min(32).max(44)).max(4),
  signerKeys: z.array(z.string().min(32).max(44)).max(4).optional(),
  followups: z.array(z.string().max(60)).max(3),
});
export type Answer = z.infer<typeof AnswerSchema>;

export type AskEvent =
  | { type: 'step'; tool: string; label: string }
  | { type: 'answer'; answer: Answer; model: string }
  | { type: 'text'; text: string }
  | { type: 'error'; code: string };

const STEP_LABEL: Record<string, (i: Record<string, unknown>) => string> = {
  search_programs: (i) => `Searching programs${i.name ? ` named “${i.name}”` : i.maxStage != null ? ` at Stage ${i.maxStage} or below` : ''}`,
  get_program: (i) => `Reading the record of ${PROGRAM_NAMES[String(i.programId)] ?? `${String(i.programId).slice(0, 4)}…${String(i.programId).slice(-4)}`}`,
  get_signer: (i) => (i.key ? `Reading signer ${String(i.key).slice(0, 4)}…${String(i.key).slice(-4)}` : 'Ranking signers by money behind them'),
  get_changes: () => 'Reading control changes',
  get_stage_rules: () => 'Reading the stage rules',
};

/** Streamed Ask: emits a step for each record read, then the structured answer. history = earlier turns, oldest first. */
export async function askStream(question: string, history: { q: string; a: string }[], emit: (e: AskEvent) => void): Promise<void> {
  let filed: Answer | null = null;
  const answerTool = betaZodTool({
    name: 'answer',
    description: 'File the final answer. Call exactly once, after reading the record.',
    inputSchema: AnswerSchema,
    run: async (a) => { filed = a; return 'filed'; },
  });
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const h of history.slice(-3)) messages.push({ role: 'user', content: h.q }, { role: 'assistant', content: h.a });
  messages.push({ role: 'user', content: question });
  const client = new Anthropic();
  const runner = client.beta.messages.toolRunner({
    model: ASK_MODEL, max_tokens: 4000, max_iterations: MAX_TOOL_ROUNDS + 1, stream: true,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    system: SYSTEM, tools: [...tools, answerTool], messages,
  });
  let last: Anthropic.Beta.BetaMessage | null = null;
  for await (const stream of runner) {
    const message = await stream.finalMessage();
    last = message;
    for (const b of message.content) {
      if (b.type !== 'tool_use') continue;
      // Take the answer the moment the model files it: waiting for the runner to execute the tool costs a full
      // extra model round (measured: 10-35 s per answer before this).
      if (b.name === 'answer') { const p = AnswerSchema.safeParse(b.input); if (p.success) filed = p.data; continue; }
      emit({ type: 'step', tool: b.name, label: (STEP_LABEL[b.name] ?? (() => b.name))(b.input as Record<string, unknown>) });
    }
    if (filed) break;
  }
  if (filed) return emit({ type: 'answer', answer: filed, model: last?.model ?? ASK_MODEL });
  if (last?.stop_reason === 'refusal') return emit({ type: 'error', code: 'DECLINED' });
  const text = last?.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
  emit(text ? { type: 'text', text } : { type: 'error', code: 'NO_ANSWER' });
}

export interface AskResult { answer: string; toolCalls: { name: string; input: unknown }[]; stopReason: string | null; model: string }

/** Answer one question. Throws only on configuration errors; API errors propagate as Anthropic.APIError. */
export async function ask(question: string): Promise<AskResult> {
  const client = new Anthropic();
  const runner = client.beta.messages.toolRunner({
    model: ASK_MODEL,
    max_tokens: 16000,
    max_iterations: MAX_TOOL_ROUNDS,
    output_config: { effort: 'medium' },
    // Refusal fallback (on by default per the Claude API guidance): a policy decline re-runs on the routed fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    tools,
    messages: [{ role: 'user', content: question }],
  });
  const toolCalls: AskResult['toolCalls'] = [];
  let final: Anthropic.Beta.BetaMessage | null = null;
  for await (const message of runner) {
    final = message;
    for (const b of message.content) if (b.type === 'tool_use') toolCalls.push({ name: b.name, input: b.input });
  }
  if (!final) throw new Error('no response');
  const answer = final.stop_reason === 'refusal'
    ? 'This question was declined. Try asking about a program, a signer, a stage, or recent control changes.'
    : final.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
  return { answer, toolCalls, stopReason: final.stop_reason, model: final.model };
}
