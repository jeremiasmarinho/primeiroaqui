-- Foto de perfil do usuário (Fase C do login).
-- IF NOT EXISTS porque em DEV a coluna foi aplicada manualmente antes desta
-- migration existir (drift de agente concorrente); em produção aplica normal.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
