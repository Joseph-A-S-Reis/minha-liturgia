CREATE TABLE IF NOT EXISTS "devotion_campaigns" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "linked_event_id" text,
  "name" varchar(160) NOT NULL,
  "description" text,
  "purpose" varchar(140) NOT NULL,
  "type" varchar(24) NOT NULL,
  "duration_days" integer NOT NULL,
  "start_date" timestamp NOT NULL,
  "timezone" varchar(80) DEFAULT 'America/Sao_Paulo' NOT NULL,
  "priest_name" varchar(140),
  "status" varchar(24) DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "devotion_campaigns_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "devotion_campaigns_linked_event_id_user_events_id_fk"
    FOREIGN KEY ("linked_event_id") REFERENCES "user_events"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "devotion_campaigns_duration_days_check"
    CHECK ("duration_days" >= 1 AND "duration_days" <= 730)
);

CREATE TABLE IF NOT EXISTS "devotion_daily_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "campaign_id" text NOT NULL,
  "user_id" text NOT NULL,
  "day_index" integer NOT NULL,
  "date_local" varchar(10) NOT NULL,
  "note" text,
  "checked_in_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "devotion_daily_logs_campaign_id_devotion_campaigns_id_fk"
    FOREIGN KEY ("campaign_id") REFERENCES "devotion_campaigns"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "devotion_daily_logs_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "devotion_daily_logs_day_index_check"
    CHECK ("day_index" >= 1),
  CONSTRAINT "devotion_daily_logs_date_local_check"
    CHECK ("date_local" ~ '^\\d{4}-\\d{2}-\\d{2}$')
);

CREATE TABLE IF NOT EXISTS "devotion_reminders" (
  "id" text PRIMARY KEY NOT NULL,
  "campaign_id" text NOT NULL,
  "user_id" text NOT NULL,
  "remind_before_minutes" integer NOT NULL,
  "channel" varchar(16) DEFAULT 'push' NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "devotion_reminders_campaign_id_devotion_campaigns_id_fk"
    FOREIGN KEY ("campaign_id") REFERENCES "devotion_campaigns"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "devotion_reminders_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "devotion_reminders_remind_before_minutes_check"
    CHECK ("remind_before_minutes" >= 0 AND "remind_before_minutes" <= 20160)
);

CREATE INDEX IF NOT EXISTS "devotion_campaigns_user_status_start_idx"
  ON "devotion_campaigns" ("user_id", "status", "start_date");

CREATE INDEX IF NOT EXISTS "devotion_campaigns_user_updated_idx"
  ON "devotion_campaigns" ("user_id", "updated_at");

CREATE UNIQUE INDEX IF NOT EXISTS "devotion_daily_logs_campaign_day_unique"
  ON "devotion_daily_logs" ("campaign_id", "day_index");

CREATE UNIQUE INDEX IF NOT EXISTS "devotion_daily_logs_campaign_date_unique"
  ON "devotion_daily_logs" ("campaign_id", "date_local");

CREATE INDEX IF NOT EXISTS "devotion_daily_logs_user_date_idx"
  ON "devotion_daily_logs" ("user_id", "date_local");

CREATE UNIQUE INDEX IF NOT EXISTS "devotion_reminders_campaign_channel_minute_unique"
  ON "devotion_reminders" ("campaign_id", "channel", "remind_before_minutes");

CREATE INDEX IF NOT EXISTS "devotion_reminders_user_enabled_idx"
  ON "devotion_reminders" ("user_id", "is_enabled");