ALTER TABLE "library_assets"
ADD "storage_object_key" text;

UPDATE "library_assets"
SET "storage_object_key" = "drive_file_id"
WHERE "storage_object_key" IS NULL
	AND "drive_file_id" IS NOT NULL;

ALTER TABLE "library_assets"
DROP COLUMN IF EXISTS "drive_file_id";
