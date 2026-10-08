CREATE TABLE "pending_action" (
	"address" text PRIMARY KEY NOT NULL,
	"multisig" text NOT NULL,
	"tx_index" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"status_at" timestamp with time zone,
	"approvals" integer NOT NULL,
	"threshold" integer,
	"timelock_s" integer,
	"actions" jsonb NOT NULL,
	"controls" jsonb NOT NULL,
	"control_relevant" boolean NOT NULL,
	"explanation" text,
	"explained_by" text,
	"first_seen" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_seen" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "pending_action_multisig" ON "pending_action" USING btree ("multisig");