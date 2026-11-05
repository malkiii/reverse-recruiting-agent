CREATE TABLE "application_recipients" (
	"application_id" bigint NOT NULL,
	"decision_maker_id" bigint NOT NULL,
	CONSTRAINT "application_recipients_application_id_decision_maker_id_pk" PRIMARY KEY("application_id","decision_maker_id")
);
--> statement-breakpoint
ALTER TABLE "application_recipients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decision_makers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "decision_makers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"company_id" bigint NOT NULL,
	"name" text NOT NULL,
	"headline" text NOT NULL,
	"profile_url" text NOT NULL,
	"email" text,
	"job_function" text NOT NULL,
	"found_at" timestamp with time zone NOT NULL,
	CONSTRAINT "decision_makers_company_name_unique" UNIQUE("company_id","name")
);
--> statement-breakpoint
ALTER TABLE "decision_makers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "actor_runs" ADD COLUMN "application_id" bigint;--> statement-breakpoint
ALTER TABLE "actor_runs" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "people_found_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "application_recipients" ADD CONSTRAINT "application_recipients_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_recipients" ADD CONSTRAINT "application_recipients_decision_maker_id_decision_makers_id_fk" FOREIGN KEY ("decision_maker_id") REFERENCES "public"."decision_makers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_makers" ADD CONSTRAINT "decision_makers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;