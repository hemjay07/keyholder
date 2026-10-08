CREATE TABLE "claim_check" (
	"day" date NOT NULL,
	"file" text NOT NULL,
	"protocol" text NOT NULL,
	"status" text NOT NULL,
	"check" jsonb NOT NULL,
	CONSTRAINT "claim_check_day_file_pk" PRIMARY KEY("day","file")
);
--> statement-breakpoint
CREATE TABLE "control_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"program_id" text NOT NULL,
	"kind" text NOT NULL,
	"path" text NOT NULL,
	"from_value" jsonb,
	"to_value" jsonb,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "control_record" (
	"day" date NOT NULL,
	"program_id" text NOT NULL,
	"stage" integer NOT NULL,
	"usd_floor" double precision,
	"record" jsonb NOT NULL,
	CONSTRAINT "control_record_day_program_id_pk" PRIMARY KEY("day","program_id")
);
--> statement-breakpoint
CREATE TABLE "record_day" (
	"day" date PRIMARY KEY NOT NULL,
	"rules_version" text NOT NULL,
	"record_version" text NOT NULL,
	"summary" jsonb NOT NULL,
	"anchor" jsonb,
	"overlaps" jsonb NOT NULL,
	"timelock_carried_from" date,
	"built_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signer_entry" (
	"day" date NOT NULL,
	"key" text NOT NULL,
	"usd_behind" double precision NOT NULL,
	"worst_stage" integer,
	"entry" jsonb NOT NULL,
	CONSTRAINT "signer_entry_day_key_pk" PRIMARY KEY("day","key")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "control_event_uniq" ON "control_event" USING btree ("day","program_id","kind","path");--> statement-breakpoint
CREATE INDEX "control_event_program" ON "control_event" USING btree ("program_id","day");--> statement-breakpoint
CREATE INDEX "control_record_day_stage" ON "control_record" USING btree ("day","stage");