CREATE TABLE "skipped_apify_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"usable_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skipped_apify_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "alert_state" text DEFAULT 'dashboard-only' NOT NULL;