-- Fundacao da integracao Pagar.me (Core API v5, sandbox). Mesmo padrao
-- IF NOT EXISTS de 20260806230000_user_avatar / 20260807120000_store_logo,
-- para o caso de a coluna ter sido aplicada manualmente em DEV antes desta
-- migration.

-- Store: dados do recebedor (split) da loja no Pagar.me.
-- recipientStatus fica como TEXT (nao enum) porque os valores vem do
-- Pagar.me (registration, affiliation, active, ...) e podem mudar sem que a
-- gente controle o schema deles.
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "pagarmeRecipientId" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "recipientStatus" TEXT;

-- Order: rastreamento do pagamento no Pagar.me e o split calculado no
-- momento da criacao da order de pagamento.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pagarmeOrderId" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "platformFeeCents" INTEGER;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "storeAmountCents" INTEGER;
