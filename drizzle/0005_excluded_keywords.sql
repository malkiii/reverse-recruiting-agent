CREATE TABLE "excluded_keywords" (
	"keyword" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "excluded_keywords" ENABLE ROW LEVEL SECURITY;