ALTER TABLE "jobs" ADD COLUMN "found_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Jobs saved before this was recorded count as found on the day they were posted.
UPDATE "jobs" SET "found_at" = "post_day"::timestamptz;
