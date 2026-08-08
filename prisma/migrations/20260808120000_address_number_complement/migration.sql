-- Numero e complemento do endereco. Mesmo padrao IF NOT EXISTS das
-- migrations anteriores (20260806230000_user_avatar etc), para o caso de a
-- coluna ter sido aplicada manualmente em DEV antes desta migration.
--
-- Regra de negocio (nao expressa no schema, validada em zod + cliente):
-- numero presente -> complemento opcional; sem numero (casa s/n) ->
-- complemento obrigatorio, para o entregador conseguir achar o endereco.

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "number" TEXT;
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "complement" TEXT;
