CREATE TABLE "daily_anchor" (
	"day" date PRIMARY KEY NOT NULL,
	"row_count" integer NOT NULL,
	"sha256" text NOT NULL,
	"cluster" text NOT NULL,
	"signature" text NOT NULL,
	"slot" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
