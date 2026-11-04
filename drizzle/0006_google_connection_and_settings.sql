CREATE TABLE "google_connection" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"refresh_token" text NOT NULL,
	"access_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "single_row" CHECK (id = 1)
);
--> statement-breakpoint
ALTER TABLE "google_connection" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"resume_folder_id" text,
	"resume_folder_name" text,
	CONSTRAINT "single_row" CHECK (id = 1)
);
--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;