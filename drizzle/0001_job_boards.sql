CREATE TABLE "actor_runs" (
	"run_id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"token" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actor_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_board_settings" (
	"source" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"search_urls" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_board_settings" ENABLE ROW LEVEL SECURITY;