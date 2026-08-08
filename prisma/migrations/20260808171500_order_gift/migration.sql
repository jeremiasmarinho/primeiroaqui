-- Item 8 — comprar para presente. O endereço de entrega do presente é o
-- Address já referenciado por addressId no Order (nenhuma tabela nova).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "isGift" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "giftRecipientName" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "giftMessage" TEXT;
