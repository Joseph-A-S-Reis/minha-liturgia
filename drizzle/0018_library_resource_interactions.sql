ALTER TABLE "library_resources"
  ADD COLUMN IF NOT EXISTS "total_likes" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "total_comments" integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS "library_resource_bookmarks" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "resource_id" text NOT NULL REFERENCES "library_resources"("id") ON DELETE cascade,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_resource_bookmarks_user_resource_unique"
  ON "library_resource_bookmarks" ("user_id", "resource_id");
CREATE INDEX IF NOT EXISTS "library_resource_bookmarks_user_created_idx"
  ON "library_resource_bookmarks" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "library_resource_bookmarks_resource_user_idx"
  ON "library_resource_bookmarks" ("resource_id", "user_id");

CREATE TABLE IF NOT EXISTS "library_resource_likes" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "resource_id" text NOT NULL REFERENCES "library_resources"("id") ON DELETE cascade,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_resource_likes_user_resource_unique"
  ON "library_resource_likes" ("user_id", "resource_id");
CREATE INDEX IF NOT EXISTS "library_resource_likes_user_created_idx"
  ON "library_resource_likes" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "library_resource_likes_resource_user_idx"
  ON "library_resource_likes" ("resource_id", "user_id");

CREATE TABLE IF NOT EXISTS "library_resource_comments" (
  "id" text PRIMARY KEY NOT NULL,
  "resource_id" text NOT NULL REFERENCES "library_resources"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "library_resource_comments_resource_created_idx"
  ON "library_resource_comments" ("resource_id", "created_at");
CREATE INDEX IF NOT EXISTS "library_resource_comments_user_updated_idx"
  ON "library_resource_comments" ("user_id", "updated_at");

CREATE INDEX IF NOT EXISTS "library_resources_published_stats_idx"
  ON "library_resources" ("status", "published_at", "total_likes", "total_comments");
