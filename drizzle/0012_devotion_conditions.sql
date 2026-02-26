CREATE TABLE IF NOT EXISTS "devotion_conditions" (
  "id" text PRIMARY KEY NOT NULL,
  "campaign_id" text NOT NULL,
  "user_id" text NOT NULL,
  "name" varchar(140) NOT NULL,
  "description" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "devotion_conditions_campaign_id_devotion_campaigns_id_fk"
    FOREIGN KEY ("campaign_id") REFERENCES "devotion_campaigns"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "devotion_conditions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "devotion_conditions_sort_order_check"
    CHECK ("sort_order" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "devotion_conditions_campaign_sort_unique"
  ON "devotion_conditions" ("campaign_id", "sort_order");

CREATE INDEX IF NOT EXISTS "devotion_conditions_campaign_name_idx"
  ON "devotion_conditions" ("campaign_id", "name");

CREATE INDEX IF NOT EXISTS "devotion_conditions_user_idx"
  ON "devotion_conditions" ("user_id");