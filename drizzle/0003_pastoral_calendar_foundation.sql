CREATE TABLE "user_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" varchar(160) NOT NULL,
	"message" text,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp,
	"all_day" boolean DEFAULT true NOT NULL,
	"timezone" varchar(80) DEFAULT 'America/Sao_Paulo' NOT NULL,
	"recurrence" varchar(16) DEFAULT 'none' NOT NULL,
	"recurrence_interval" integer DEFAULT 1 NOT NULL,
	"recurrence_until" timestamp,
	"source" varchar(16) DEFAULT 'custom' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX user_events_user_start_idx ON user_events (user_id, start_at);
--> statement-breakpoint
CREATE INDEX user_events_user_updated_idx ON user_events (user_id, updated_at);
--> statement-breakpoint
CREATE TABLE "event_reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"remind_before_minutes" integer NOT NULL,
	"channel" varchar(16) DEFAULT 'push' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_reminders" ADD CONSTRAINT "event_reminders_event_id_user_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."user_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_reminders" ADD CONSTRAINT "event_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX event_reminders_event_channel_before_unique ON event_reminders (event_id, channel, remind_before_minutes);
--> statement-breakpoint
CREATE INDEX event_reminders_user_enabled_idx ON event_reminders (user_id, is_enabled);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"timezone" varchar(80) DEFAULT 'America/Sao_Paulo' NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"quiet_hours_start" integer,
	"quiet_hours_end" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"content_encoding" varchar(24) DEFAULT 'aes128gcm' NOT NULL,
	"user_agent" text,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX push_subscriptions_endpoint_unique ON push_subscriptions (endpoint);
--> statement-breakpoint
CREATE INDEX push_subscriptions_user_updated_idx ON push_subscriptions (user_id, updated_at);
--> statement-breakpoint
CREATE TABLE "ics_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"description" varchar(140),
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "ics_tokens" ADD CONSTRAINT "ics_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX ics_tokens_token_hash_unique ON ics_tokens (token_hash);
--> statement-breakpoint
CREATE INDEX ics_tokens_user_revoked_idx ON ics_tokens (user_id, revoked_at);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_id" text,
	"reminder_id" text,
	"channel" varchar(16) NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"sent_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_event_id_user_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."user_events"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_reminder_id_event_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."event_reminders"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX notification_deliveries_schedule_idx ON notification_deliveries (status, scheduled_for);
--> statement-breakpoint
CREATE INDEX notification_deliveries_user_sent_idx ON notification_deliveries (user_id, sent_at);
