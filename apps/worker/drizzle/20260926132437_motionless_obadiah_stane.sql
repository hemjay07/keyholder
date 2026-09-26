CREATE TABLE "attestations" (
	"id" serial PRIMARY KEY NOT NULL,
	"protocol_id" text NOT NULL,
	"slot" bigint NOT NULL,
	"kind" varchar(20) NOT NULL,
	"state_hash" "bytea",
	"tx_sig" text,
	"pda" text,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "authorities" (
	"address" text PRIMARY KEY NOT NULL,
	"kind" varchar(20) NOT NULL,
	"multisig_addr" text,
	"updated_slot" bigint
);
--> statement-breakpoint
CREATE TABLE "control_state" (
	"protocol_id" text NOT NULL,
	"slot" bigint NOT NULL,
	"state" jsonb NOT NULL,
	"state_hash" "bytea",
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "control_state_protocol_id_slot_pk" PRIMARY KEY("protocol_id","slot")
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"alert_id" text NOT NULL,
	"channel" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"attempts" smallint DEFAULT 0,
	"last_error" text,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigint NOT NULL,
	"event_uid" text NOT NULL,
	"slot" bigint NOT NULL,
	"block_time" timestamp with time zone NOT NULL,
	"signature" text NOT NULL,
	"ix_path" text NOT NULL,
	"protocol_id" text,
	"program_id" text,
	"kind" varchar(50) NOT NULL,
	"category" text,
	"actor" text[],
	"payload" jsonb,
	"privilege_basis" varchar(20),
	"decode_confidence" varchar(20),
	"finalized" boolean DEFAULT false,
	"tombstoned" boolean DEFAULT false,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "events_event_uid_unique" UNIQUE("event_uid")
);
--> statement-breakpoint
CREATE TABLE "ingest_cursor" (
	"source" text PRIMARY KEY NOT NULL,
	"last_slot" bigint NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"queue" text NOT NULL,
	"task_id" text,
	"payload" jsonb,
	"attempts" smallint DEFAULT 0,
	"max_attempts" smallint DEFAULT 3,
	"last_error" text,
	"status" varchar(20) DEFAULT 'pending',
	"run_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "multisig_members" (
	"multisig" text NOT NULL,
	"member" text NOT NULL,
	"permissions" smallint,
	"added_slot" bigint NOT NULL,
	"removed_slot" bigint,
	CONSTRAINT "multisig_members_multisig_member_added_slot_pk" PRIMARY KEY("multisig","member","added_slot")
);
--> statement-breakpoint
CREATE TABLE "multisigs" (
	"address" text PRIMARY KEY NOT NULL,
	"kind" varchar(20),
	"threshold" smallint,
	"time_lock_s" integer,
	"config_authority" text,
	"member_count" smallint,
	"updated_slot" bigint
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"protocol_id" text NOT NULL,
	"kind" varchar(20) NOT NULL,
	"value_usd" text,
	"detail" jsonb,
	"resolved_at" timestamp with time zone NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "program_versions" (
	"program_id" text NOT NULL,
	"deploy_slot" bigint NOT NULL,
	"elf_sha256" "bytea",
	"elf_size" integer,
	"sbpf_version" smallint,
	"elf_r2_key" text,
	"upgrade_sig" text,
	"authority" text,
	"verify_status" varchar(20),
	"verify_commit" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "program_versions_program_id_deploy_slot_pk" PRIMARY KEY("program_id","deploy_slot")
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"program_id" text PRIMARY KEY NOT NULL,
	"protocol_id" text,
	"label" text,
	"programdata_addr" text,
	"loader" varchar(20),
	"is_executable" boolean,
	"first_seen_slot" bigint,
	"tracked" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "protocol_scores" (
	"protocol_id" text PRIMARY KEY NOT NULL,
	"score" smallint,
	"components" jsonb,
	"as_of_slot" bigint,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "protocols" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"website" text,
	"x_handle" text,
	"tvl_usd" text,
	"tvl_source" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "raw_tx" (
	"signature" text PRIMARY KEY NOT NULL,
	"slot" bigint NOT NULL,
	"block_time" timestamp with time zone NOT NULL,
	"commitment" varchar(20) NOT NULL,
	"source" varchar(20) NOT NULL,
	"tx" "bytea",
	"status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "replay_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"slot" bigint NOT NULL,
	"severity" varchar(20) NOT NULL,
	"rule_id" text NOT NULL,
	"explanation" text,
	"facts" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "replay_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"incident" text NOT NULL,
	"from_slot" bigint NOT NULL,
	"to_slot" bigint NOT NULL,
	"rules_version" integer NOT NULL,
	"first_alert_slot" bigint,
	"lead_time_seconds" integer,
	"event_sequence" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "risk_deltas" (
	"id" serial PRIMARY KEY NOT NULL,
	"delta_uid" text NOT NULL,
	"protocol_id" text NOT NULL,
	"event_ids" bigint[],
	"rule_id" text NOT NULL,
	"rule_version" integer NOT NULL,
	"severity" varchar(20) NOT NULL,
	"score_before" smallint,
	"score_after" smallint,
	"explanation" text,
	"facts" jsonb,
	"status" varchar(20) DEFAULT 'active',
	"correction_id" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "risk_deltas_delta_uid_unique" UNIQUE("delta_uid")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scope" varchar(20) NOT NULL,
	"target" text NOT NULL,
	"min_severity" varchar(20) DEFAULT 'low',
	"channels" text[] DEFAULT ARRAY[]::text[],
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "verification_checks" (
	"program_id" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"is_verified" boolean,
	"on_chain_hash" text,
	"executable_hash" text,
	"commit" text,
	"repo_url" text,
	"raw" jsonb,
	CONSTRAINT "verification_checks_program_id_checked_at_pk" PRIMARY KEY("program_id","checked_at")
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"secret_enc" "bytea",
	"active" boolean DEFAULT true,
	"failure_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "x_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"risk_delta_id" integer NOT NULL,
	"tweet_id" text,
	"text" text NOT NULL,
	"posted_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_protocol_id_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attestations_protocol" ON "attestations" USING btree ("protocol_id");--> statement-breakpoint
CREATE INDEX "control_state_protocol_slot" ON "control_state" USING btree ("protocol_id","slot");--> statement-breakpoint
CREATE INDEX "deliveries_alert" ON "deliveries" USING btree ("alert_id");--> statement-breakpoint
CREATE INDEX "events_protocol_slot" ON "events" USING btree ("protocol_id","slot");--> statement-breakpoint
CREATE INDEX "events_kind_slot" ON "events" USING btree ("kind","slot");--> statement-breakpoint
CREATE INDEX "events_program_slot" ON "events" USING btree ("program_id","slot");--> statement-breakpoint
CREATE INDEX "jobs_queue_status" ON "jobs" USING btree ("queue","status");--> statement-breakpoint
CREATE INDEX "jobs_run_at" ON "jobs" USING btree ("run_at");--> statement-breakpoint
CREATE INDEX "multisig_members_multisig" ON "multisig_members" USING btree ("multisig");--> statement-breakpoint
CREATE INDEX "positions_wallet_protocol" ON "positions" USING btree ("wallet","protocol_id");--> statement-breakpoint
CREATE INDEX "program_versions_program_id" ON "program_versions" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "raw_tx_slot_idx" ON "raw_tx" USING btree ("slot");--> statement-breakpoint
CREATE INDEX "raw_tx_status_idx" ON "raw_tx" USING btree ("status");--> statement-breakpoint
CREATE INDEX "replay_alerts_run" ON "replay_alerts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "risk_deltas_protocol_created" ON "risk_deltas" USING btree ("protocol_id","created_at");--> statement-breakpoint
CREATE INDEX "risk_deltas_severity_created" ON "risk_deltas" USING btree ("severity","created_at");--> statement-breakpoint
CREATE INDEX "subscriptions_user" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_checks_program" ON "verification_checks" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "webhooks_user" ON "webhooks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "x_posts_risk_delta" ON "x_posts" USING btree ("risk_delta_id");