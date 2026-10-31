CREATE TABLE "jobs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"source" text NOT NULL,
	"title" text NOT NULL,
	"company_name" text NOT NULL,
	"location" text NOT NULL,
	"url" text NOT NULL,
	"post_day" date NOT NULL,
	"description" text,
	CONSTRAINT "jobs_url_key" UNIQUE("url"),
	CONSTRAINT "jobs_title_company_name_post_day_key" UNIQUE("title","company_name","post_day")
);
--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;