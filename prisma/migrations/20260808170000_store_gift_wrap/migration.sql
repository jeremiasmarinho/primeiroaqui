-- Item 9 — loja informa se embala para presente (pré-requisito do item 8).
-- Mesmo padrão IF NOT EXISTS das migrations anteriores (ex.:
-- 20260806231500_store_category), para o caso de a coluna já ter sido
-- aplicada manualmente em DEV antes desta migration.
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "giftWrapAvailable" BOOLEAN NOT NULL DEFAULT false;
