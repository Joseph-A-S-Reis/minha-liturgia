ALTER TABLE "devotion_confession_sins"
  ALTER COLUMN "nature" DROP NOT NULL;

UPDATE "devotion_confession_sins"
SET "sin_type" = 'outro'
WHERE "sin_type" IN ('mortal', 'venial');

ALTER TABLE "devotion_confession_sins"
  DROP CONSTRAINT IF EXISTS "devotion_confession_sins_sin_type_check";

ALTER TABLE "devotion_confession_sins"
  ADD CONSTRAINT "devotion_confession_sins_sin_type_check"
  CHECK ("sin_type" IN ('mandamento_de_deus', 'mandamento_da_igreja', 'outro'));