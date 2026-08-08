-- Bairro/setor do endereco (Item 11/12 — critico para a entrega, o ViaCEP
-- ja devolve em `bairro`). Mesmo padrao IF NOT EXISTS das migrations
-- anteriores (20260808120000_address_number_complement etc), para o caso de
-- a coluna ter sido aplicada manualmente em DEV antes desta migration.
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;
