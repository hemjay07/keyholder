ALTER TABLE "authorities" ADD COLUMN "evidence_signature" text;--> statement-breakpoint
ALTER TABLE "authorities" ADD COLUMN "evidence_note" text;--> statement-breakpoint
ALTER TABLE "replay_runs" ADD COLUMN "posture" jsonb;