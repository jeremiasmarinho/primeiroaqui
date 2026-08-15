-- Correção de drift de produção (2026-08-15) — SOMENTE mudanças aditivas.
-- Contexto: banco tem sobras de branches antigas; o diff completo incluía
-- DROPs (agents/coupons/threads/phone/couponCode) que ficam para uma janela
-- de limpeza pós-lançamento. Aqui entra apenas o que o app atual exige.
-- Idempotente: seguro re-executar.

-- notifications: forma nova (href + índice composto)
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "href" TEXT;
DROP INDEX IF EXISTS "notifications_userId_idx";
CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx"
  ON "notifications"("userId", "createdAt");

-- orders: retirada na loja (Item 14)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "isPickup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ALTER COLUMN "addressId" DROP NOT NULL;

-- stores: endereço físico + retirada; default de isActive alinhado ao schema
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "pickupAvailable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "stores" ALTER COLUMN "isActive" SET DEFAULT true;
