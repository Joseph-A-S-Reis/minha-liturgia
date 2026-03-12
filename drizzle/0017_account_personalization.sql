ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "devotion_saint" varchar(120),
  ADD COLUMN IF NOT EXISTS "community_name" varchar(160);