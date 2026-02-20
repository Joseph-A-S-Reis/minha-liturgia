CREATE TABLE "library_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" varchar(180) NOT NULL,
	"title" varchar(220) NOT NULL,
	"summary" text,
	"content_markdown" text,
	"resource_type" varchar(24) DEFAULT 'article' NOT NULL,
	"level" varchar(24) DEFAULT 'basic' NOT NULL,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	"is_official_church_source" boolean DEFAULT false NOT NULL,
	"source_name" varchar(140),
	"source_url" text,
	"cover_image_url" text,
	"published_at" timestamp,
	"created_by_user_id" text,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_resources" ADD CONSTRAINT "library_resources_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "library_resources" ADD CONSTRAINT "library_resources_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX library_resources_slug_unique ON library_resources (slug);
--> statement-breakpoint
CREATE INDEX library_resources_status_type_published_idx ON library_resources (status, resource_type, published_at);
--> statement-breakpoint
CREATE INDEX library_resources_official_published_idx ON library_resources (is_official_church_source, published_at);
--> statement-breakpoint
CREATE TABLE "library_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"section" varchar(40) DEFAULT 'formacao' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX library_categories_slug_unique ON library_categories (slug);
--> statement-breakpoint
CREATE INDEX library_categories_section_sort_idx ON library_categories (section, sort_order);
--> statement-breakpoint
CREATE TABLE "library_resource_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"category_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_resource_categories" ADD CONSTRAINT "library_resource_categories_resource_id_library_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."library_resources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "library_resource_categories" ADD CONSTRAINT "library_resource_categories_category_id_library_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."library_categories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX library_resource_categories_unique ON library_resource_categories (resource_id, category_id);
--> statement-breakpoint
CREATE INDEX library_resource_categories_category_idx ON library_resource_categories (category_id);
--> statement-breakpoint
CREATE TABLE "library_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"kind" varchar(24) NOT NULL,
	"title" varchar(180),
	"mime_type" varchar(120),
	"external_url" text,
	"drive_file_id" text,
	"byte_size" integer,
	"duration_seconds" integer,
	"extracted_text" text,
	"transcription_text" text,
	"status" varchar(24) DEFAULT 'ready' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_assets" ADD CONSTRAINT "library_assets_resource_id_library_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."library_resources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX library_assets_resource_kind_idx ON library_assets (resource_id, kind);
--> statement-breakpoint
CREATE INDEX library_assets_status_idx ON library_assets (status);
--> statement-breakpoint
CREATE TABLE "library_resource_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"source_asset_id" text,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"token_estimate" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_resource_chunks" ADD CONSTRAINT "library_resource_chunks_resource_id_library_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."library_resources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "library_resource_chunks" ADD CONSTRAINT "library_resource_chunks_source_asset_id_library_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."library_assets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX library_resource_chunks_resource_chunk_unique ON library_resource_chunks (resource_id, chunk_index);
--> statement-breakpoint
CREATE INDEX library_resource_chunks_resource_idx ON library_resource_chunks (resource_id);
--> statement-breakpoint
CREATE TABLE "library_ingestion_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"source_name" varchar(140) NOT NULL,
	"source_url" text,
	"section" varchar(40) DEFAULT 'santa-igreja' NOT NULL,
	"title" varchar(260) NOT NULL,
	"summary" text,
	"content_url" text,
	"content_raw" text,
	"image_url" text,
	"published_at" timestamp,
	"status" varchar(24) DEFAULT 'pending_review' NOT NULL,
	"linked_resource_id" text,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_ingestion_queue" ADD CONSTRAINT "library_ingestion_queue_linked_resource_id_library_resources_id_fk" FOREIGN KEY ("linked_resource_id") REFERENCES "public"."library_resources"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "library_ingestion_queue" ADD CONSTRAINT "library_ingestion_queue_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX library_ingestion_queue_status_created_idx ON library_ingestion_queue (status, created_at);
--> statement-breakpoint
CREATE INDEX library_ingestion_queue_section_status_idx ON library_ingestion_queue (section, status);
