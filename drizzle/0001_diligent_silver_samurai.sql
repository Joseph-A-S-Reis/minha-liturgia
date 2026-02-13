CREATE TABLE "verse_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"version_id" text NOT NULL,
	"book_id" text NOT NULL,
	"chapter" integer NOT NULL,
	"verse" integer NOT NULL,
	"content_html" text NOT NULL,
	"color" varchar(24) DEFAULT 'amber' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verse_notes" ADD CONSTRAINT "verse_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "verse_notes" ADD CONSTRAINT "verse_notes_version_id_bible_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."bible_versions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "verse_notes" ADD CONSTRAINT "verse_notes_book_id_bible_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."bible_books"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "verse_notes_user_chapter_idx" ON "verse_notes" USING btree ("user_id","version_id","book_id","chapter","updated_at");
--> statement-breakpoint
CREATE INDEX "verse_notes_user_verse_idx" ON "verse_notes" USING btree ("user_id","version_id","book_id","chapter","verse","updated_at");
