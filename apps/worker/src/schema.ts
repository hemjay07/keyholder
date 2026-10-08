// File: apps/worker/src/schema.ts
// [VERIFIED] — Drizzle schema from ARCHITECTURE.md §4, arch/B-worker.md §1.
// packages/db re-exports every table below so web and worker share one
// schema (arch/D-web.md §3).

import {
  pgTable,
  text,
  bigint,
  integer,
  smallint,
  timestamp,
  customType,
  jsonb,
  varchar,
  boolean,
  serial,
  index,
  primaryKey,
  date,
  doublePrecision,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// drizzle-orm 0.45 has no built-in `bytea` column helper; define one.
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const protocols = pgTable('protocols', {
  id: text('id').primaryKey(), // slug
  name: text('name').notNull(),
  category: text('category'),
  website: text('website'),
  x_handle: text('x_handle'),
  tvl_usd: text('tvl_usd'), // numeric as text for precision
  tvl_source: text('tvl_source'),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const programs = pgTable('programs', {
  program_id: text('program_id').primaryKey(),
  protocol_id: text('protocol_id').references(() => protocols.id),
  label: text('label'),
  programdata_addr: text('programdata_addr'),
  loader: varchar('loader', { length: 20 }), // 'v3' | 'immutable' | 'native'
  is_executable: boolean('is_executable'),
  first_seen_slot: bigint('first_seen_slot', { mode: 'number' }),
  tracked: boolean('tracked').default(false),
});

export const program_versions = pgTable(
  'program_versions',
  {
    program_id: text('program_id').notNull(),
    deploy_slot: bigint('deploy_slot', { mode: 'number' }).notNull(),
    elf_sha256: bytea('elf_sha256'),
    elf_size: integer('elf_size'),
    sbpf_version: smallint('sbpf_version'),
    elf_r2_key: text('elf_r2_key'),
    upgrade_sig: text('upgrade_sig'),
    authority: text('authority'),
    verify_status: varchar('verify_status', { length: 20 }), // 'verified' | 'drifted' | 'never'
    verify_commit: text('verify_commit'),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.program_id, table.deploy_slot] }),
    idx_program: index('program_versions_program_id').on(table.program_id),
  })
);

export const authorities = pgTable('authorities', {
  address: text('address').primaryKey(),
  kind: varchar('kind', { length: 20 }).notNull(), // 'single' | 'squads_v4' | etc.
  multisig_addr: text('multisig_addr'),
  updated_slot: bigint('updated_slot', { mode: 'number' }),
  // DEV-043 (coordinator review, 2026-09-26): the real transaction signature
  // that supports this authority's classification (a Squads invocation that
  // resolved it to a vault, or a loader Upgrade/SetAuthority ix it signed
  // itself), or null when classified from account ownership alone (e.g. SPL
  // Governance) or when unresolved. `evidence_note` carries the free-text
  // reason when there is no single signature (e.g. "no on-chain history:
  // N signatures observed").
  evidence_signature: text('evidence_signature'),
  evidence_note: text('evidence_note'),
});

export const multisigs = pgTable('multisigs', {
  address: text('address').primaryKey(),
  kind: varchar('kind', { length: 20 }),
  threshold: smallint('threshold'),
  time_lock_s: integer('time_lock_s'),
  config_authority: text('config_authority'),
  member_count: smallint('member_count'),
  updated_slot: bigint('updated_slot', { mode: 'number' }),
});

export const multisig_members = pgTable(
  'multisig_members',
  {
    multisig: text('multisig').notNull(),
    member: text('member').notNull(),
    permissions: smallint('permissions'),
    added_slot: bigint('added_slot', { mode: 'number' }).notNull(),
    removed_slot: bigint('removed_slot', { mode: 'number' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.multisig, table.member, table.added_slot] }),
    idx: index('multisig_members_multisig').on(table.multisig),
  })
);

export const raw_tx = pgTable(
  'raw_tx',
  {
    signature: text('signature').primaryKey(),
    slot: bigint('slot', { mode: 'number' }).notNull(),
    block_time: timestamp('block_time', { withTimezone: true }).notNull(),
    commitment: varchar('commitment', { length: 20 }).notNull(), // 'confirmed' | 'finalized'
    source: varchar('source', { length: 20 }).notNull(), // 'stream' | 'backfill' | 'poll'
    tx: bytea('tx'), // compressed JSON
    status: varchar('status', { length: 20 }).default('pending'), // 'pending' | 'decoded' | 'failed'
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    idx_slot: index('raw_tx_slot_idx').on(table.slot),
    idx_status: index('raw_tx_status_idx').on(table.status),
  })
);

export const events = pgTable(
  'events',
  {
    // DEV (2026-09-26, pipeline wiring): the original column was a bare
    // `bigint NOT NULL` with no default and no primary key — no insert into
    // `events` could ever succeed. Made a real bigint identity primary key
    // via a drizzle-kit migration (see drizzle/*_events_id_identity.sql).
    // GENERATED BY DEFAULT (not ALWAYS): schema.test.ts (pre-existing,
    // never modified per this task's binding rules) inserts an explicit
    // `id` value; BY DEFAULT still auto-generates one whenever a caller
    // omits it, which is what every pipeline insert does.
    // `event_uid` (sig:ix_path) remains the idempotency key for inserts.
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    event_uid: text('event_uid').notNull().unique(), // sig:ix_path
    slot: bigint('slot', { mode: 'number' }).notNull(),
    block_time: timestamp('block_time', { withTimezone: true }).notNull(),
    signature: text('signature').notNull(),
    ix_path: text('ix_path').notNull(), // '3' or '3.1'
    protocol_id: text('protocol_id'),
    program_id: text('program_id'),
    kind: varchar('kind', { length: 50 }).notNull(),
    category: text('category'),
    actor: text('actor').array(),
    payload: jsonb('payload'),
    privilege_basis: varchar('privilege_basis', { length: 20 }), // 'idl_relation' | 'name' | 'runtime_match'
    decode_confidence: varchar('decode_confidence', { length: 20 }),
    finalized: boolean('finalized').default(false),
    tombstoned: boolean('tombstoned').default(false),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    idx_protocol_slot: index('events_protocol_slot').on(table.protocol_id, table.slot),
    idx_kind_slot: index('events_kind_slot').on(table.kind, table.slot),
    idx_program_slot: index('events_program_slot').on(table.program_id, table.slot),
  })
);

// The last successful live read of each protocol's control (P26). control_state
// is written only when the facts change; this row moves on every good read, so
// the site can say when control was last checked, not only when it last changed.
export const control_checks = pgTable('control_checks', {
  protocol_id: text('protocol_id').primaryKey(),
  slot: bigint('slot', { mode: 'number' }).notNull(),
  checked_at: timestamp('checked_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// One row per protocol per UTC day: the first successful live read of that day
// (the data moat's observation log, design/DATA-MOAT.md). Written even when
// nothing changed, so the history is continuous and dated by slot.
export const control_daily = pgTable(
  'control_daily',
  {
    day: date('day', { mode: 'string' }).notNull(),
    protocol_id: text('protocol_id').notNull(),
    slot: bigint('slot', { mode: 'number' }).notNull(),
    facts: jsonb('facts').notNull(),
    facts_hash: bytea('facts_hash').notNull(),
    checked_at: timestamp('checked_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ pk: primaryKey({ columns: [table.day, table.protocol_id] }) })
);

// One row per covered program per UTC day (design/DATA-MOAT.md, layer 3 at full
// coverage): who controlled its upgrade authority that day, read from chain.
export const program_daily = pgTable(
  'program_daily',
  {
    day: date('day', { mode: 'string' }).notNull(),
    program_id: text('program_id').notNull(),
    slot: bigint('slot', { mode: 'number' }).notNull(),
    upgrade_authority: text('upgrade_authority'),
    authority_kind: text('authority_kind').notNull(),
    multisig: text('multisig'),
    threshold: integer('threshold'),
    members: jsonb('members'),
    // Added 2026-10-08 (record v2): null for single keys, immutable, and multisigs without a timelock field (Squads v3, coral).
    timelock_s: integer('timelock_s'),
    ms_version: text('ms_version'),
    checked_at: timestamp('checked_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ pk: primaryKey({ columns: [table.day, table.program_id] }) })
);

export const control_state = pgTable(
  'control_state',
  {
    protocol_id: text('protocol_id').notNull(),
    slot: bigint('slot', { mode: 'number' }).notNull(),
    state: jsonb('state').notNull(), // serialized ControlState
    state_hash: bytea('state_hash'),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.protocol_id, table.slot] }),
    idx: index('control_state_protocol_slot').on(table.protocol_id, table.slot),
  })
);

export const risk_deltas = pgTable(
  'risk_deltas',
  {
    id: serial('id').primaryKey(),
    delta_uid: text('delta_uid').notNull().unique(), // protocol:slot:rule
    protocol_id: text('protocol_id').notNull(),
    event_ids: bigint('event_ids', { mode: 'number' }).array(),
    rule_id: text('rule_id').notNull(),
    rule_version: integer('rule_version').notNull(),
    severity: varchar('severity', { length: 20 }).notNull(),
    score_before: smallint('score_before'),
    score_after: smallint('score_after'),
    explanation: text('explanation'),
    facts: jsonb('facts'),
    status: varchar('status', { length: 20 }).default('active'), // 'active' | 'corrected' | 'retracted'
    correction_id: integer('correction_id'),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    idx_protocol: index('risk_deltas_protocol_created').on(table.protocol_id, table.created_at),
    idx_severity: index('risk_deltas_severity_created').on(table.severity, table.created_at),
  })
);

export const protocol_scores = pgTable('protocol_scores', {
  protocol_id: text('protocol_id').primaryKey(),
  score: smallint('score'),
  components: jsonb('components'),
  as_of_slot: bigint('as_of_slot', { mode: 'number' }),
  updated_at: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull(),
    scope: varchar('scope', { length: 20 }).notNull(),
    target: text('target').notNull(),
    min_severity: varchar('min_severity', { length: 20 }).default('low'),
    channels: text('channels').array().default(sql`ARRAY[]::text[]`),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    idx: index('subscriptions_user').on(table.user_id),
  })
);

export const webhooks = pgTable(
  'webhooks',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull(),
    url: text('url').notNull(),
    secret_enc: bytea('secret_enc'),
    active: boolean('active').default(true),
    failure_count: integer('failure_count').default(0),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    idx: index('webhooks_user').on(table.user_id),
  })
);

export const deliveries = pgTable(
  'deliveries',
  {
    id: serial('id').primaryKey(),
    alert_id: text('alert_id').notNull(),
    channel: varchar('channel', { length: 20 }).notNull(), // 'telegram' | 'email' | 'webhook' | 'x'
    status: varchar('status', { length: 20 }).notNull(),
    attempts: smallint('attempts').default(0),
    last_error: text('last_error'),
    delivered_at: timestamp('delivered_at'),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    idx: index('deliveries_alert').on(table.alert_id),
  })
);

export const attestations = pgTable(
  'attestations',
  {
    id: serial('id').primaryKey(),
    protocol_id: text('protocol_id').notNull(),
    slot: bigint('slot', { mode: 'number' }).notNull(),
    kind: varchar('kind', { length: 20 }).notNull(), // 'sas' | 'policy'
    state_hash: bytea('state_hash'),
    tx_sig: text('tx_sig'),
    pda: text('pda'),
    status: varchar('status', { length: 20 }).notNull(), // 'pending' | 'confirmed' | 'failed'
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    idx: index('attestations_protocol').on(table.protocol_id),
  })
);

export const verification_checks = pgTable(
  'verification_checks',
  {
    program_id: text('program_id').notNull(),
    checked_at: timestamp('checked_at', { withTimezone: true }).notNull(),
    is_verified: boolean('is_verified'),
    on_chain_hash: text('on_chain_hash'),
    executable_hash: text('executable_hash'),
    commit: text('commit'),
    repo_url: text('repo_url'),
    raw: jsonb('raw'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.program_id, table.checked_at] }),
    idx: index('verification_checks_program').on(table.program_id),
  })
);

export const x_posts = pgTable(
  'x_posts',
  {
    id: serial('id').primaryKey(),
    risk_delta_id: integer('risk_delta_id').notNull(),
    tweet_id: text('tweet_id'),
    text: text('text').notNull(),
    posted_at: timestamp('posted_at'),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    idx: index('x_posts_risk_delta').on(table.risk_delta_id),
  })
);

export const replay_runs = pgTable('replay_runs', {
  id: text('id').primaryKey(),
  incident: text('incident').notNull(),
  from_slot: bigint('from_slot', { mode: 'number' }).notNull(),
  to_slot: bigint('to_slot', { mode: 'number' }).notNull(),
  rules_version: integer('rules_version').notNull(),
  // DEV-043 (coordinator review, 2026-09-26): redefined to mean the FIRST
  // TRANSITION ALERT — the first delta caused by a real change/event (a
  // new multisig created, an admin change, a durable nonce created by a
  // controller, a privileged ix by a newly-assigned admin, ...) — not a
  // standing condition that was already true when the window opened (that
  // is `posture`, below). See apps/worker/src/replay/drift-replay.ts.
  first_alert_slot: bigint('first_alert_slot', { mode: 'number' }),
  lead_time_seconds: integer('lead_time_seconds'),
  // The standing control posture observed at the START of the replay
  // window (e.g. "2-of-5 multisig, no timelock") — real facts, reported as
  // posture, never as an "alert the product fired" (a standing condition's
  // lead time is an artifact of where the window happens to start, not a
  // warning that fired).
  posture: jsonb('posture'),
  event_sequence: text('event_sequence'),
  created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const replay_alerts = pgTable(
  'replay_alerts',
  {
    id: serial('id').primaryKey(),
    run_id: text('run_id').notNull(),
    slot: bigint('slot', { mode: 'number' }).notNull(),
    severity: varchar('severity', { length: 20 }).notNull(),
    rule_id: text('rule_id').notNull(),
    explanation: text('explanation'),
    facts: jsonb('facts'),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    idx: index('replay_alerts_run').on(table.run_id),
  })
);

export const ingest_cursor = pgTable('ingest_cursor', {
  source: text('source').primaryKey(),
  last_slot: bigint('last_slot', { mode: 'number' }).notNull(),
  updated_at: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const jobs = pgTable(
  'jobs',
  {
    id: serial('id').primaryKey(),
    queue: text('queue').notNull(),
    task_id: text('task_id'),
    payload: jsonb('payload'),
    attempts: smallint('attempts').default(0),
    max_attempts: smallint('max_attempts').default(3),
    last_error: text('last_error'),
    status: varchar('status', { length: 20 }).default('pending'),
    run_at: timestamp('run_at').default(sql`CURRENT_TIMESTAMP`),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    idx_queue: index('jobs_queue_status').on(table.queue, table.status),
    idx_run_at: index('jobs_run_at').on(table.run_at),
  })
);

// DEV (Phase 4, web layer): Postgres-backed sliding-window rate limiting
// (arch/D-web.md §6, §14) — one database, no external rate-limit service.
export const rate_limits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').default(0),
  reset_at: bigint('reset_at', { mode: 'number' }),
  created_at: timestamp('created_at', { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
  updated_at: timestamp('updated_at', { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

export const positions = pgTable(
  'positions',
  {
    id: serial('id').primaryKey(),
    wallet: text('wallet').notNull(),
    protocol_id: text('protocol_id').notNull(),
    kind: varchar('kind', { length: 20 }).notNull(),
    value_usd: text('value_usd'),
    detail: jsonb('detail'),
    resolved_at: timestamp('resolved_at', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    idx_wallet: index('positions_wallet_protocol').on(table.wallet, table.protocol_id),
  })
);

// One row per day the observation log was anchored on chain (design/MOAT-BUILD.md, C).
export const daily_anchor = pgTable('daily_anchor', {
  day: date('day', { mode: 'string' }).primaryKey(),
  row_count: integer('row_count').notNull(),
  sha256: text('sha256').notNull(),
  cluster: text('cluster').notNull(),
  signature: text('signature').notNull(),
  slot: bigint('slot', { mode: 'number' }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ── Control Record v2 (design/REVAMP-3.md, D2–D7) ───────────────────────────
// Written by src/records/build.ts (--db) after the daily log; read by the site and /api/v1.
export const record_day = pgTable('record_day', {
  day: date('day', { mode: 'string' }).primaryKey(),
  rules_version: text('rules_version').notNull(),
  record_version: text('record_version').notNull(),
  summary: jsonb('summary').notNull(),
  anchor: jsonb('anchor'),
  overlaps: jsonb('overlaps').notNull(),
  timelock_carried_from: date('timelock_carried_from', { mode: 'string' }),
  built_at: timestamp('built_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const control_record = pgTable('control_record', {
  day: date('day', { mode: 'string' }).notNull(),
  program_id: text('program_id').notNull(),
  stage: integer('stage').notNull(),
  usd_floor: doublePrecision('usd_floor'),
  record: jsonb('record').notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.day, t.program_id] }), byStage: index('control_record_day_stage').on(t.day, t.stage) }));

export const signer_entry = pgTable('signer_entry', {
  day: date('day', { mode: 'string' }).notNull(),
  key: text('key').notNull(),
  usd_behind: doublePrecision('usd_behind').notNull(),
  worst_stage: integer('worst_stage'),
  entry: jsonb('entry').notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.day, t.key] }) }));

export const control_event = pgTable('control_event', {
  id: serial('id').primaryKey(),
  day: date('day', { mode: 'string' }).notNull(),
  program_id: text('program_id').notNull(),
  kind: text('kind').notNull(),
  path: text('path').notNull(),
  from_value: jsonb('from_value'),
  to_value: jsonb('to_value'),
  extra: jsonb('extra'),
}, (t) => ({ uniq: uniqueIndex('control_event_uniq').on(t.day, t.program_id, t.kind, t.path), byProgram: index('control_event_program').on(t.program_id, t.day) }));

export const claim_check = pgTable('claim_check', {
  day: date('day', { mode: 'string' }).notNull(),
  file: text('file').notNull(),
  protocol: text('protocol').notNull(),
  status: text('status').notNull(),
  check: jsonb('check').notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.day, t.file] }) }));
