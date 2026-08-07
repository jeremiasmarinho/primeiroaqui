-- Logo da loja (painel do lojista).
-- IF NOT EXISTS segue o mesmo padrao de 20260806230000_user_avatar, para o
-- caso de a coluna ter sido aplicada manualmente em DEV antes desta migration.
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
