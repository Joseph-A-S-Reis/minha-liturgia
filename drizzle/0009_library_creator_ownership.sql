-- Backfill de ownership para regras de edição/exclusão por papel.
-- Para conteúdos antigos onde o criador ficou nulo, reaproveita reviewed_by_user_id quando disponível.
UPDATE "library_resources"
SET
  "created_by_user_id" = "reviewed_by_user_id",
  "updated_at" = now()
WHERE
  "created_by_user_id" IS NULL
  AND "reviewed_by_user_id" IS NOT NULL;
