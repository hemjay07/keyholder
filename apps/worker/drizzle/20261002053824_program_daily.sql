CREATE TABLE "program_daily" (
	"day" date NOT NULL,
	"program_id" text NOT NULL,
	"slot" bigint NOT NULL,
	"upgrade_authority" text,
	"authority_kind" text NOT NULL,
	"multisig" text,
	"threshold" integer,
	"members" jsonb,
	"checked_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "program_daily_day_program_id_pk" PRIMARY KEY("day","program_id")
);
