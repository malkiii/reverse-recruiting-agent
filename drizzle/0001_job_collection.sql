CREATE TABLE "actor_runs" (
	"run_id" text PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"token" text NOT NULL,
	"search" jsonb,
	"started_at" timestamp with time zone NOT NULL,
	"results_saved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "actor_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_board_settings" (
	"source" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"searches" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_board_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"source" text NOT NULL,
	"title" text NOT NULL,
	"company_name" text NOT NULL,
	"location" text NOT NULL,
	"url" text NOT NULL,
	"post_day" date NOT NULL,
	"description" text,
	"company_linkedin_url" text,
	CONSTRAINT "jobs_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_job_collection" ON "function_runs" USING btree ("function_name") WHERE status = 'running' and function_name = 'collect-jobs';