CREATE TABLE IF NOT EXISTS "devotion_confession_notes" (
  "id" text PRIMARY KEY NOT NULL,
  "campaign_id" text NOT NULL,
  "user_id" text NOT NULL,
  "note" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "devotion_confession_notes_campaign_id_devotion_campaigns_id_fk"
    FOREIGN KEY ("campaign_id") REFERENCES "devotion_campaigns"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "devotion_confession_notes_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "devotion_confession_notes_sort_order_check"
    CHECK ("sort_order" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "devotion_confession_notes_campaign_sort_unique"
  ON "devotion_confession_notes" ("campaign_id", "sort_order");

CREATE INDEX IF NOT EXISTS "devotion_confession_notes_campaign_created_idx"
  ON "devotion_confession_notes" ("campaign_id", "created_at");

CREATE INDEX IF NOT EXISTS "devotion_confession_notes_user_updated_idx"
  ON "devotion_confession_notes" ("user_id", "updated_at");

CREATE TABLE IF NOT EXISTS "devotion_confession_sins" (
  "id" text PRIMARY KEY NOT NULL,
  "campaign_id" text NOT NULL,
  "user_id" text NOT NULL,
  "sin_type" varchar(24) NOT NULL,
  "nature" varchar(180) NOT NULL,
  "root_sin" varchar(48) NOT NULL,
  "frequency" varchar(60),
  "details" text,
  "is_confessed" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "devotion_confession_sins_campaign_id_devotion_campaigns_id_fk"
    FOREIGN KEY ("campaign_id") REFERENCES "devotion_campaigns"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "devotion_confession_sins_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "devotion_confession_sins_sort_order_check"
    CHECK ("sort_order" >= 0),
  CONSTRAINT "devotion_confession_sins_sin_type_check"
    CHECK ("sin_type" IN ('mortal', 'venial'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "devotion_confession_sins_campaign_sort_unique"
  ON "devotion_confession_sins" ("campaign_id", "sort_order");

CREATE INDEX IF NOT EXISTS "devotion_confession_sins_campaign_confessed_idx"
  ON "devotion_confession_sins" ("campaign_id", "is_confessed");

CREATE INDEX IF NOT EXISTS "devotion_confession_sins_user_updated_idx"
  ON "devotion_confession_sins" ("user_id", "updated_at");
