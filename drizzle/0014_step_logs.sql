CREATE TABLE "step_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "step_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"application_id" bigint NOT NULL,
	"step" text NOT NULL,
	"attempt" integer NOT NULL,
	"status" text NOT NULL,
	"result" text,
	"error" text,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "step_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "step_logs" ADD CONSTRAINT "step_logs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- An Application already sending resumes at the send step on a Retry.
UPDATE "applications" SET "current_step" = 'send' WHERE "status" = 'sending';
