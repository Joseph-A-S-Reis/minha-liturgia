CREATE TABLE "maria_citation_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"mode" varchar(24) NOT NULL,
	"query_text" text NOT NULL,
	"answer_excerpt" text,
	"citation_index" integer NOT NULL,
	"citation_score" integer NOT NULL,
	"resource_id" text,
	"resource_slug" varchar(180) NOT NULL,
	"resource_title" varchar(220) NOT NULL,
	"source_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "maria_citation_events" ADD CONSTRAINT "maria_citation_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "maria_citation_events" ADD CONSTRAINT "maria_citation_events_resource_id_library_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."library_resources"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX maria_citation_events_user_created_idx ON maria_citation_events (user_id, created_at);
--> statement-breakpoint
CREATE INDEX maria_citation_events_resource_created_idx ON maria_citation_events (resource_slug, created_at);
--> statement-breakpoint
CREATE INDEX maria_citation_events_mode_created_idx ON maria_citation_events (mode, created_at);
