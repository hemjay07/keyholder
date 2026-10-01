CREATE TABLE "control_daily" (
	"day" date NOT NULL,
	"protocol_id" text NOT NULL,
	"slot" bigint NOT NULL,
	"facts" jsonb NOT NULL,
	"facts_hash" "bytea" NOT NULL,
	"checked_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "control_daily_day_protocol_id_pk" PRIMARY KEY("day","protocol_id")
);
