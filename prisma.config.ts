// Este projeto carrega variaveis de `.env.local` (padrao ja usado no repo),
// nao o `.env` padrao do Prisma. Ver .superpowers/sdd/fase-2-brief.md.
//
// DEVIACAO SINALIZADA: no Prisma 7, `url`/`directUrl` no bloco `datasource`
// do schema.prisma nao sao mais suportados (P1012). A conexao agora e
// resolvida aqui. Para `migrate`/`generate`/`studio` usamos DIRECT_URL,
// que aponta para o pooler do Supabase em modo session (porta 5432).
// Não é uma conexão verdadeiramente direta, mas funciona para DDL/migrations
// porque migrações precisam de uma conexão de sessão persistente (não pode
// passar pelo pooler em modo transaction, porta 6543, que fecha conexões).
// Em runtime, o app deve construir o PrismaClient com um driver adapter
// apontando para DATABASE_URL (pooler em modo transaction) — isso fica
// fora do escopo desta fase (schema + migracao inicial).
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});
