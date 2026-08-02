// Este projeto carrega variaveis de `.env.local` (padrao ja usado no repo),
// nao o `.env` padrao do Prisma. Ver .superpowers/sdd/fase-2-brief.md.
//
// DEVIACAO SINALIZADA: no Prisma 7, `url`/`directUrl` no bloco `datasource`
// do schema.prisma nao sao mais suportados (P1012). A conexao agora e
// resolvida aqui. Para `migrate`/`generate`/`studio` usamos DIRECT_URL
// (conexao direta, nao pooled) porque migracoes de schema nao devem passar
// por pooler de conexoes (ex.: pgbouncer/Supabase pooler). Em runtime, o
// app deve construir o PrismaClient com um driver adapter apontando para
// DATABASE_URL (pooled) — isso fica fora do escopo desta fase (schema +
// migracao inicial).
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
