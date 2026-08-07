-- Categoria da loja (fundação, sem verticais de navegação).
-- IF NOT EXISTS / dependência tratada com DO block porque em DEV o enum e a
-- coluna "category" já existiam (com valores diferentes) por drift de um
-- worktree concorrente (backend-mvp, superado); esse drift foi limpo
-- manualmente em DEV antes desta migration ser criada. Em produção aplica normal.
DO $$ BEGIN
  CREATE TYPE "StoreCategory" AS ENUM ('MERCADO', 'PADARIA', 'FARMACIA', 'PETSHOP', 'HORTIFRUTI', 'RESTAURANTE', 'SERVICOS', 'OUTROS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "category" "StoreCategory" NOT NULL DEFAULT 'OUTROS';
