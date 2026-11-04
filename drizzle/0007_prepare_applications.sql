CREATE TABLE "applications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "applications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"job_id" bigint NOT NULL,
	"status" text NOT NULL,
	"current_step" text NOT NULL,
	"error" text,
	"job_page" text,
	"industry_keywords" jsonb,
	"job_location" text,
	"job_summary" text,
	"resume_file_id" text,
	"resume_name" text,
	"resume_link" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "applications_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
ALTER TABLE "applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "function_runs" ADD COLUMN "application_id" bigint;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "llm_provider" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "llm_model" text;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;