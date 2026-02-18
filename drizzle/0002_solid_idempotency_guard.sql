CREATE TABLE "mutation_idempotency" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action_type" varchar(80) NOT NULL,
	"action_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mutation_idempotency" ADD CONSTRAINT "mutation_idempotency_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX mutation_idempotency_user_action_key_unique ON mutation_idempotency (user_id, action_type, action_key);
--> statement-breakpoint
CREATE INDEX mutation_idempotency_user_expires_idx ON mutation_idempotency (user_id, expires_at);
