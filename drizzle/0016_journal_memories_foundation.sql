CREATE TABLE IF NOT EXISTS "journal_memories" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(120) NOT NULL,
  "memory_date" date NOT NULL,
  "description" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "journal_memories_user_memory_date_idx"
  ON "journal_memories" ("user_id", "memory_date", "created_at");

CREATE TABLE IF NOT EXISTS "journal_memory_attachments" (
  "id" text PRIMARY KEY,
  "memory_id" text NOT NULL REFERENCES "journal_memories"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "file_name" varchar(260) NOT NULL,
  "mime_type" varchar(120) NOT NULL,
  "file_size" integer NOT NULL,
  "data" bytea NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "journal_memory_attachments_memory_created_idx"
  ON "journal_memory_attachments" ("memory_id", "created_at");

CREATE INDEX IF NOT EXISTS "journal_memory_attachments_user_created_idx"
  ON "journal_memory_attachments" ("user_id", "created_at");