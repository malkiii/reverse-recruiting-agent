CREATE TABLE "job_feeds" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "job_feeds_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"url" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_feeds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Jobs saved before this rule may already be Duplicate Jobs. The first one saved is kept.
DELETE FROM "jobs" AS "later" USING "jobs" AS "earlier"
WHERE lower("later"."title") = lower("earlier"."title")
	AND lower("later"."company_name") = lower("earlier"."company_name")
	AND "later"."post_day" = "earlier"."post_day"
	AND "later"."id" > "earlier"."id";--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_title_company_post_day_unique" ON "jobs" USING btree (lower("title"),lower("company_name"),"post_day");