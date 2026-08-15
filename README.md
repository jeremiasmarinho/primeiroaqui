# Primeiro Aqui MVP

Marketplace local: SPA React 19 + Vite servida pelo mesmo container Node que roda a API
(Hono + Prisma sobre Postgres do Supabase). Um único processo, mesma origem — sem CORS,
sem `VITE_API_URL`.

## Stack

- **Front:** React 19, Vite, Tailwind CSS, wouter
- **API:** Hono (`src/server/`), Prisma 7 (`prisma/`), Supabase (auth/storage), Pagar.me (pagamentos)
- **Deploy:** Docker (`Dockerfile`, imagem única) em VPS via Coolify — ver `docs/runbook.md`

## Como rodar localmente

```bash
npm install               # roda prisma generate via postinstall
cp .env.example .env.local  # preencha as credenciais (Supabase, banco, Pagar.me)
npm run dev               # front em http://localhost:5173
npm run dev:server        # API em http://localhost:3333
```

## Comandos úteis

```bash
npm run gate       # lint + typecheck + test:unit + build + check:bundle (portão canônico)
npm run test:e2e   # Playwright
npm run test:db    # testes que tocam banco real
npm run docker:build
```

## Deploy

**O deploy é Docker + VPS (Coolify) — NÃO Vercel.** O processo completo, incluindo
migrations (`prisma migrate deploy`), variáveis de ambiente e verificação pós-deploy,
está em **`docs/runbook.md`** — esse documento é a fonte de verdade operacional.

Ordem resumida: `npm run gate` verde → `npx prisma migrate deploy` (se houver migration
nova) → push na branch acompanhada pelo Coolify → validar `/api/health` e uma rota
profunda da SPA.

## Estrutura

- `src/` — SPA (telas em `src/screens/`, estado em `src/state/`, cliente HTTP em `src/lib/api.ts`)
- `src/server/` — API Hono (`root.ts` monta `/api` + estáticos; rotas em `src/server/routes/`)
- `prisma/` — schema e migrations
- `docs/` — runbook operacional, ADRs e planos
