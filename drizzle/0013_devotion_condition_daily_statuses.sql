CREATE TABLE IF NOT EXISTS "devotion_condition_daily_statuses" (
  "id" text PRIMARY KEY NOT NULL,
  "campaign_id" text NOT NULL,
  "condition_id" text NOT NULL,
  "user_id" text NOT NULL,
  "day_index" integer NOT NULL,
  "date_local" varchar(10) NOT NULL,
  "completed_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "devotion_condition_daily_statuses_campaign_id_devotion_campaigns_id_fk"
    FOREIGN KEY ("campaign_id") REFERENCES "devotion_campaigns"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "devotion_condition_daily_statuses_condition_id_devotion_conditions_id_fk"
    FOREIGN KEY ("condition_id") REFERENCES "devotion_conditions"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "devotion_condition_daily_statuses_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "devotion_condition_daily_statuses_day_index_check"
    CHECK ("day_index" >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS "devotion_condition_daily_statuses_condition_date_unique"
  ON "devotion_condition_daily_statuses" ("condition_id", "date_local");

CREATE INDEX IF NOT EXISTS "devotion_condition_daily_statuses_campaign_date_idx"
  ON "devotion_condition_daily_statuses" ("campaign_id", "date_local");

CREATE INDEX IF NOT EXISTS "devotion_condition_daily_statuses_user_date_idx"
  ON "devotion_condition_daily_statuses" ("user_id", "date_local");
