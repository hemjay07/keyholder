CREATE TABLE "control_checks" (
	"protocol_id" text PRIMARY KEY NOT NULL,
	"slot" bigint NOT NULL,
	"checked_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
