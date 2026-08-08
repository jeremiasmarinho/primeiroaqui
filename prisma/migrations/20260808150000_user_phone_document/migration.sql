-- Telefone e CPF do usuario (Item 3: editar perfil).
-- IF NOT EXISTS segue o mesmo padrao de 20260806230000_user_avatar e
-- 20260807120000_store_logo, para o caso de a coluna ter sido aplicada
-- manualmente em DEV antes desta migration existir.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "document" TEXT;
