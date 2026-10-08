// File: apps/web/src/lib/ask.ts
// Ask Keyholder: a question in plain language, answered by Claude using read-only tools over the
// Control Record (lib/records.ts). The model is never a source of facts: every number, key, program
// and transaction in an answer must come from a tool result, and the answer cites them.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';
import { STAGE_RULES, RULES_VERSION } from '@keyholder/stages';
import { latestDay, registry, programRecord, stageHistory, signer, topSigners, changes } from './records';

export const ASK_MODEL = 'claude-opus-5-5';
export const MAX_QUESTION_CHARS = 600;
const MAX_TOOL_ROUNDS = 6;

const SYSTEM = `You answer questions about who can move money on Solana, using Keyholder's Control Record.
Rules:
- Use the tools for every fact. If the tools do not return it, say you do not have it. Never use outside knowledge for addresses, amounts, stages, signers or dates.
- Cite what you state: program ids, signer keys and transaction signatures exactly as the tools return them.
- Programs are named by id. A repo is "built from", never "owned by"; do not name a protocol as the owner unless a tool result says so.
- Stages are Control Stages ${RULES_VERSION}: 0 one key; 1 multisig with no 24 h delay somewhere (or admin fields not read); 2 every path a 2+ multisig with a 24 h+ delay; 3 immutable or 7 d+ delays.
- Dollar figures are floors from a vault census (liquid tokens only); say "at least".
- Be brief: a direct answer first, then the supporting rows.`;

const day = async () => {
  const d = await latestDay();
  if (!d) throw new Error('no record day built yet');
  return d;
};

const tools = [
  betaZodTool({
    name: 'search_programs',
    description: 'Find covered programs by stage, timelock and dollars traced, from the latest Control Record day. Returns at most `limit` rows, largest dollars first.',
    inputSchema: z.object({
      maxStage: z.number().int().min(0).max(3).optional().describe('only programs at this stage or below'),
      minStage: z.number().int().min(0).max(3).optional(),
      noTimelock: z.boolean().optional().describe('only multisig upgrade paths with no timelock'),
      minUsd: z.number().optional().describe('only programs with at least this many dollars traced'),
      closed: z.boolean().optional().describe('only closed programs'),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    run: async (q) => {
      const d = await day();
      const rows = (await registry(d))
        .filter((r) => (q.maxStage == null || r.stage <= q.maxStage) && (q.minStage == null || r.stage >= q.minStage))
        .filter((r) => !q.noTimelock || (r.threshold != null && !r.timelockS))
        .filter((r) => q.minUsd == null || (r.usdFloor ?? 0) >= q.minUsd)
        .filter((r) => !q.closed || r.modifiers.includes('closed'))
        .sort((a, b) => (b.usdFloor ?? 0) - (a.usdFloor ?? 0));
      return JSON.stringify({ day: d, matched: rows.length, rows: rows.slice(0, q.limit ?? 20) });
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
