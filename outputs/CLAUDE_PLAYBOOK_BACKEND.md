# Playbook de Execução — Backend Primeiro Aqui

> Cole este arquivo inteiro no terminal do Claude Code (`claude`) dentro do repositório `primeiro-aqui-mvp`. Execute as fases em ordem. Não pule fases. Não avance com gate vermelho.

## Contexto

Você atua como **Arquiteto de Software Sênior + Engenheiro de Confiabilidade (SRE)**. Prioriza correção, portabilidade e manutenibilidade sobre velocidade aparente.

**Projeto:** Primeiro Aqui — marketplace hiperlocal.
**Estado atual:** frontend React pronto (12 telas, 273 testes verdes, bundle 312 kB / limite 330 kB). Sem auth server-side (WU-22 bloqueada por isso). Este playbook constrói o backend que destrava WU-22 e liga o frontend a dados reais.

**Decisões já tomadas (não reabrir sem motivo novo):**
- Banco: PostgreSQL 16 gerenciado no Supabase, região `sa-east-1`.
- Extensões obrigatórias: `pg_trgm`, `unaccent`, `postgis`, `pgcrypto`, `citext`.
- ORM: Prisma.
- Storage de fotos: Supabase Storage.
- Auth: Supabase Auth.
- API: Hono (roda em Node/Bun/Workers — sem lock-in de plataforma).
- Paleta (não afeta backend, mas mantenha coerência se tocar em seeds/fixtures): `primary #3483FA`, `accent #FFE600`.

## Regras de execução (invioláveis)

1. **Nunca destrua dados sem confirmação explícita.** Qualquer `migrate reset`, `DROP`, `TRUNCATE`, ou operação que apague linhas: pare e peça confirmação ao usuário antes de rodar.
2. Trabalhe na branch `feat/backend-mvp`. Nunca commite direto em `main` neste playbook.
3. **Commits atômicos por fase.** Um commit (ou mais, se a fase tiver sub-passos claros) ao final de cada fase concluída — nunca misture fases no mesmo commit.
4. Após cada fase: rode `npm run lint && npm run typecheck && npm run test:unit`. Se algo falhar, pare e reporte — não avance para a próxima fase.
5. Se uma instrução deste playbook depender de uma ação manual do usuário (ex.: criar projeto no Supabase pelo navegador), pare, peça exatamente os dados que precisa, e só continue quando recebê-los.
6. Nunca invente valores de `.env` — se uma variável não foi fornecida, pare e pergunte.

## Convenções de código

- TypeScript `strict: true`. Zero `any`.
- Arquivos com no máximo ~300 linhas. Se um arquivo crescer além disso, separe por responsabilidade.
- Teste ao lado do código (`arquivo.ts` + `arquivo.test.ts`), seguindo o padrão já usado em `src/lib`.
- Validação de entrada com Zod em toda rota que recebe body/query.
- Logs estruturados (pino ou equivalente), nunca `console.log` em código de produção.
- Sem segredo em texto plano commitado. `.env*` (exceto `.env.example`) sempre no `.gitignore`.

---

## Fase 0 — Pré-check e branch

**Objetivo:** garantir ambiente limpo e branch de trabalho criada antes de qualquer mudança.

```bash
node -v          # precisa ser >=20
npm -v
git status       # precisa estar limpo (working tree clean)
git checkout -b feat/backend-mvp
```

Se `git status` não estiver limpo, pare e reporte ao usuário — não crie a branch em cima de mudanças não commitadas ou stashadas sem perguntar primeiro.

Criar `.env.example` (versionado) e `.env.local` (git-ignored, com placeholders por enquanto):

```bash
cat > .env.example <<'EOF'
# Supabase (preenchido na Fase 1)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE=

# Prisma / Postgres (preenchido na Fase 1)
DATABASE_URL=
DIRECT_URL=

# App
NODE_ENV=development
PORT=3333
EOF

cp .env.example .env.local
```

Confirmar que `.env.local` está no `.gitignore`:

```bash
grep -qxF '.env.local' .gitignore || echo '.env.local' >> .gitignore
grep -qxF '.env' .gitignore || echo '.env' >> .gitignore
```

**Critério de conclusão:**
- [ ] Node >= 20 confirmado
- [ ] branch `feat/backend-mvp` criada e ativa
- [ ] `.env.example` criado e versionável
- [ ] `.env.local` criado e ignorado pelo git

**Commit sugerido:**
```bash
git add .env.example .gitignore
git commit -m "chore: prepara branch feat/backend-mvp e template de env"
```

---

## Fase 1 — Provisionar Supabase (ação manual do usuário)

**Objetivo:** ter um projeto Postgres gerenciado com as extensões certas antes de tocar em Prisma.

Esta fase é feita pelo usuário no navegador. Claude Code deve **parar aqui e apresentar estas instruções**, depois esperar o usuário colar as variáveis.

### Instruções para o usuário (fazer manualmente)

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto.
2. Região: **South America (São Paulo) — `sa-east-1`**.
3. Anote a senha do banco gerada (ou defina uma forte) — vai precisar dela na connection string.
4. Em **Project Settings → API**, copie:
   - `Project URL` → vira `SUPABASE_URL`
   - `anon public` key → vira `SUPABASE_ANON_KEY`
   - `service_role` key → vira `SUPABASE_SERVICE_ROLE` (**nunca exponha no frontend**)
5. Em **Project Settings → Database → Connection string**:
   - Modo `Transaction` (pgbouncer, porta 6543) → vira `DATABASE_URL` (usada em runtime pelo Prisma Client)
   - Modo `Session` / direto (porta 5432) → vira `DIRECT_URL` (usada só para `migrate`)
6. Em **SQL Editor**, rode:

```sql
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists postgis;
create extension if not exists pgcrypto;
create extension if not exists citext;
```

7. Confirme que as 5 extensões aparecem em **Database → Extensions** como habilitadas.

### Ao voltar para o Claude Code

Cole as 5 variáveis no `.env.local` (Claude Code deve pedir explicitamente cada uma se o usuário não colar todas de uma vez):

```bash
# .env.local
SUPABASE_URL=<colar>
SUPABASE_ANON_KEY=<colar>
SUPABASE_SERVICE_ROLE=<colar>
DATABASE_URL=<colar, connection string modo transaction/pgbouncer>
DIRECT_URL=<colar, connection string modo direto>
```

**Critério de conclusão:**
- [ ] `.env.local` tem as 5 variáveis preenchidas (não placeholders)
- [ ] As 5 extensões confirmadas habilitadas no painel Supabase
- [ ] Nenhum valor de `.env.local` foi commitado

**Sem commit nesta fase** (é só configuração local, `.env.local` não é versionado).

---

## Fase 2 — Prisma setup

**Objetivo:** schema versionado e migração inicial aplicada no banco Supabase.

```bash
npm i -D prisma
npm i @prisma/client
npx prisma init --datasource-provider postgresql
```

Editar `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
  extensions = [pg_trgm, unaccent, postgis, pgcrypto, citext]
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

enum UserRole {
  BUYER
  STORE_OWNER
  ADMIN
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PREPARING
  READY
  DELIVERED
  CANCELED
}

model User {
  id           String    @id @default(uuid())
  authUserId   String    @unique // id do usuário no Supabase Auth
  email        String    @unique @db.Citext
  name         String
  role         UserRole  @default(BUYER)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  stores       Store[]
  addresses    Address[]
  favorites    Favorite[]
  orders       Order[]
  reviews      Review[]

  @@map("users")
}

model Store {
  id          String    @id @default(uuid())
  ownerId     String
  owner       User      @relation(fields: [ownerId], references: [id])
  name        String
  slug        String    @unique
  description String?
  latitude    Float
  longitude   Float
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  products    Product[]
  orders      Order[]

  @@index([ownerId])
  @@map("stores")
}

model Product {
  id          String         @id @default(uuid())
  storeId     String
  store       Store          @relation(fields: [storeId], references: [id])
  title       String
  description String?
  category    String
  priceCents  Int
  stock       Int            @default(0)
  isActive    Boolean        @default(true)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  photos      ProductPhoto[]
  favorites   Favorite[]
  orderItems  OrderItem[]
  reviews     Review[]

  @@index([storeId])
  @@index([category])
  @@map("products")
}

model ProductPhoto {
  id        String   @id @default(uuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String
  thumbUrl  String
  path      String
  position  Int      @default(0)
  createdAt DateTime @default(now())

  @@index([productId])
  @@map("product_photos")
}

model Address {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  label      String
  street     String
  city       String
  state      String
  zipCode    String
  latitude   Float
  longitude  Float
  isDefault  Boolean  @default(false)
  createdAt  DateTime @default(now())

  orders     Order[]

  @@index([userId])
  @@map("addresses")
}

model Favorite {
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@id([userId, productId])
  @@map("favorites")
}

model Order {
  id          String      @id @default(uuid())
  buyerId     String
  buyer       User        @relation(fields: [buyerId], references: [id])
  storeId     String
  store       Store       @relation(fields: [storeId], references: [id])
  addressId   String
  address     Address     @relation(fields: [addressId], references: [id])
  status      OrderStatus @default(PENDING)
  totalCents  Int
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  items       OrderItem[]

  @@index([buyerId])
  @@index([storeId])
  @@map("orders")
}

model OrderItem {
  id             String  @id @default(uuid())
  orderId        String
  order          Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId      String
  product        Product @relation(fields: [productId], references: [id])
  quantity       Int
  unitPriceCents Int

  @@index([orderId])
  @@map("order_items")
}

model Review {
  id        String   @id @default(uuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  rating    Int
  comment   String?
  createdAt DateTime @default(now())

  @@index([productId])
  @@map("reviews")
}
```

Se um `schema.sql` anterior já existir no projeto com nomes ou campos diferentes, priorize a fonte existente e ajuste este schema para ficar coerente com ela — reporte a divergência antes de aplicar a migração.

```bash
npx prisma migrate dev --name init
npx prisma generate
```

**Critério de conclusão:**
- [ ] `prisma migrate dev --name init` aplicado sem erro
- [ ] `npx prisma studio` abre e mostra as 9 tabelas
- [ ] `npx prisma generate` gerou o client sem erro
- [ ] `npm run typecheck` limpo

**Commit sugerido:**
```bash
git add prisma/ package.json package-lock.json
git commit -m "feat: schema Prisma inicial e migracao no Postgres do Supabase"
```

---

## Fase 3 — Cliente Supabase (auth + storage)

**Objetivo:** wrappers tipados para autenticação e upload de fotos, com tratamento de erro consistente.

```bash
npm i @supabase/supabase-js
```

Criar `src/lib/supabaseClient.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error('Variaveis de ambiente do Supabase ausentes (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE)')
}

/** Cliente com privilegios de usuario final — respeita RLS. Uso: rotas autenticadas por token do usuario. */
export const supabasePublic: SupabaseClient = createClient(url, anonKey)

/** Cliente com service role — ignora RLS. Uso exclusivo: rotas server-side administrativas (nunca expor ao frontend). */
export const supabaseAdmin: SupabaseClient = createClient(url, serviceRoleKey)
```

Criar `src/lib/storage.ts` (upload de fotos de produto):

```ts
const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const THUMB_WIDTH = 400
const BUCKET = 'product-photos'

export class StorageValidationError extends Error {}

export type UploadedPhoto = {
  url: string
  thumbUrl: string
  path: string
}

export const validateProductPhoto = (file: { size: number; type: string }): void => {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    throw new StorageValidationError(`Tipo de arquivo nao suportado: ${file.type}`)
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new StorageValidationError(`Arquivo excede o limite de ${MAX_SIZE_BYTES / 1024 / 1024}MB`)
  }
}

export const buildStoragePath = (productId: string, fileName: string): string => {
  const ext = fileName.split('.').pop() ?? 'jpg'
  return `${productId}/${crypto.randomUUID()}.${ext}`
}

export const THUMBNAIL_WIDTH = THUMB_WIDTH
export const PRODUCT_PHOTOS_BUCKET = BUCKET
```

O upload real (`supabaseAdmin.storage.from(...)`, geração de thumbnail com `sharp` ou similar) e a rota HTTP que consome isso ficam na Fase 5, onde o endpoint de fotos é implementado — aqui só a validação e as constantes, que são testáveis isoladamente.

Testes (`src/lib/storage.test.ts`, `src/lib/supabaseClient.test.ts`): cobrir rejeição de tipo inválido, rejeição de tamanho excedido, e formato do path gerado.

**Critério de conclusão:**
- [ ] `npm run test:unit` verde incluindo os novos testes
- [ ] `npm run typecheck` limpo
- [ ] Nenhuma chave `service_role` referenciada fora de `supabaseClient.ts`

**Commit sugerido:**
```bash
git add src/lib/supabaseClient.ts src/lib/supabaseClient.test.ts src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: cliente Supabase (auth+storage) e validacao de upload de fotos"
```

---

## Fase 4 — Auth (destrava WU-22)

**Objetivo:** signup/login/logout reais via Supabase Auth, com middleware de papel.

Estrutura sugerida: `src/server/routes/auth.ts`, `src/server/middleware/auth.ts`.

```ts
// src/server/middleware/auth.ts
import type { Context, Next } from 'hono'
import { supabasePublic } from '../../lib/supabaseClient'

export type AuthedUser = { id: string; email: string; role: 'BUYER' | 'STORE_OWNER' | 'ADMIN' }

export const requireUser = async (c: Context, next: Next) => {
  const token = c.req.header('authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Nao autenticado' }, 401)

  const { data, error } = await supabasePublic.auth.getUser(token)
  if (error || !data.user) return c.json({ error: 'Token invalido' }, 401)

  c.set('authUserId', data.user.id)
  await next()
}

export const requireStoreOwner = async (c: Context, next: Next) => {
  // busca o User no Prisma pelo authUserId, confirma role === STORE_OWNER (ou ADMIN)
  // 403 caso contrario
  await next()
}

export const requireAdmin = async (c: Context, next: Next) => {
  // idem, exigindo role === ADMIN
  await next()
}
```

Rotas:

```ts
// src/server/routes/auth.ts
// POST /auth/signup   -> supabasePublic.auth.signUp + cria User no Prisma (role BUYER por padrao)
// POST /auth/login    -> supabasePublic.auth.signInWithPassword
// POST /auth/logout   -> supabasePublic.auth.signOut
// GET  /me            -> requireUser, retorna o User do Prisma correspondente ao authUserId
```

Cada rota valida body com Zod (`email`, `password`, `name` no signup) antes de tocar no Supabase.

Testes de integração: cobrir os 3 papéis (`BUYER`, `STORE_OWNER`, `ADMIN`) passando e falhando em rotas protegidas por `requireStoreOwner`/`requireAdmin`; cobrir signup duplicado, login com senha errada, `/me` sem token.

**Critério de conclusão:**
- [ ] Testes de integração cobrindo os 3 papéis, verdes
- [ ] `npm run test:unit` verde
- [ ] `npm run typecheck` e `npm run lint` limpos
- [ ] WU-22 pode ser marcada como destravada

**Commit sugerido:**
```bash
git add src/server/routes/auth.ts src/server/middleware/auth.ts
git commit -m "feat: auth real via Supabase (signup/login/logout/me) — destrava WU-22"
```

---

## Fase 5 — Endpoints Loja + Produto

**Objetivo:** dono de loja consegue criar loja, cadastrar produtos com fotos, e comprador consegue listar/filtrar produtos.

Rotas:

```ts
// src/server/routes/stores.ts
// POST  /stores              (requireStoreOwner) — cria loja para o usuario autenticado
// GET   /stores/:id          (publico)
// PATCH /stores/:id          (requireStoreOwner, dono da loja)

// src/server/routes/products.ts
// POST   /stores/:id/products         (requireStoreOwner, dono da loja)
// GET    /products                    (publico) — filtros: categoria, texto (pg_trgm/unaccent), raio-km (PostGIS)
// GET    /products/:id                (publico)
// PATCH  /products/:id                (requireStoreOwner, dono da loja)
// DELETE /products/:id                (requireStoreOwner, dono da loja)
// POST   /products/:id/photos         (requireStoreOwner, multipart, chama storage.ts)
// DELETE /products/:id/photos/:photoId (requireStoreOwner)
```

Busca por texto com `pg_trgm`/`unaccent` (via `$queryRaw` do Prisma, pois Prisma não modela full-text nativamente):

```sql
select p.* from products p
where similarity(unaccent(p.title), unaccent($1)) > 0.2
   or p.category = $2
order by similarity(unaccent(p.title), unaccent($1)) desc
limit 20;
```

Filtro por raio com PostGIS:

```sql
select p.*, st.latitude, st.longitude
from products p
join stores st on st.id = p."storeId"
where ST_DWithin(
  ST_MakePoint(st.longitude, st.latitude)::geography,
  ST_MakePoint($1, $2)::geography,
  $3 * 1000
);
```

Validação Zod em todo body de criação/edição (`title`, `priceCents`, `stock`, `category`).

**Critério de conclusão:**
- [ ] Testes de integração: criação de loja, criação de produto, upload de foto rejeitando arquivo inválido, filtro por categoria, filtro por texto, filtro por raio
- [ ] Só o dono da loja edita/exclui seus produtos (teste cobrindo 403 para outro dono)
- [ ] `npm run gate` verde

**Commit sugerido:**
```bash
git add src/server/routes/stores.ts src/server/routes/products.ts
git commit -m "feat: endpoints de loja e produto com busca por texto e raio"
```

---

## Fase 6 — Endpoints Comprador

**Objetivo:** favoritos, endereços e checkout funcionando ponta a ponta para um comprador autenticado.

```ts
// src/server/routes/favorites.ts
// POST   /favorites/:productId   (requireUser)
// DELETE /favorites/:productId   (requireUser)
// GET    /me/favorites           (requireUser)

// src/server/routes/addresses.ts
// POST /addresses       (requireUser)
// GET  /me/addresses    (requireUser)

// src/server/routes/orders.ts
// POST /orders          (requireUser) — recebe items[], addressId; valida estoque, calcula totalCents, cria Order+OrderItem em transacao
// GET  /me/orders       (requireUser)
```

Checkout dentro de uma transação Prisma (`$transaction`) para não deixar `Order` sem `OrderItem` em caso de falha parcial, e para decrementar `stock` de forma atômica.

**Critério de conclusão:**
- [ ] Testes cobrindo: favoritar/desfavoritar, checkout com estoque suficiente, checkout rejeitado por estoque insuficiente, listagem de pedidos só retorna os do próprio usuário
- [ ] `npm run gate` verde

**Commit sugerido:**
```bash
git add src/server/routes/favorites.ts src/server/routes/addresses.ts src/server/routes/orders.ts
git commit -m "feat: endpoints de favoritos, enderecos e checkout"
```

---

## Fase 7 — Dashboards (mínimo viável)

**Objetivo:** três dashboards com dados agregados reais, cada um restrito ao papel correto.

```ts
// src/server/routes/dashboard.ts
// GET /dashboard/buyer         (requireUser)        — pedidos em andamento, gasto nos ultimos 30 dias, favoritos ativos
// GET /dashboard/store/:id     (requireStoreOwner)   — vendas hoje, pedidos a preparar, produtos com estoque baixo (<5)
// GET /dashboard/admin         (requireAdmin)        — GMV do mes, taxa de conversao do funil, latencia p95
```

`requireAdmin` é o único middleware autorizado a proteger `/dashboard/admin` — nenhuma outra rota deste playbook deve reaproveitar esse caminho sem essa checagem.

GMV mensal e conversão via agregação Prisma (`groupBy`/`aggregate`); latência p95 vem da Fase 8 (OpenTelemetry) — se ainda não existir tabela de métricas quando esta fase rodar, retornar `null` no campo e marcar TODO explícito no código, não inventar número.

**Critério de conclusão:**
- [ ] Teste confirmando que comprador comum recebe 403 em `/dashboard/admin`
- [ ] Teste confirmando que dono de loja só vê dados da própria loja em `/dashboard/store/:id`
- [ ] `npm run gate` verde

**Commit sugerido:**
```bash
git add src/server/routes/dashboard.ts
git commit -m "feat: dashboards de comprador, loja e admin"
```

---

## Fase 8 — Observabilidade e SRE

**Objetivo:** visibilidade mínima de produção — traces, rate limit, health check, runbook.

```bash
npm i @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

- Instrumentar traces + métricas básicas (latência por rota, taxa de erro) — usadas pelo `/dashboard/admin` da Fase 7 para p95 real.
- Rate limiting: para o MVP, implementação in-memory por IP/usuário é suficiente (ex.: token bucket simples); documentar no código que produção com múltiplas instâncias precisa de um store compartilhado (Redis/Upstash) — não implementar Redis agora sem necessidade real (YAGNI).
- Health check:

```ts
// GET /health
// Verifica: SELECT 1 no Postgres via Prisma; ping no Supabase Storage (list de 1 arquivo no bucket)
// Retorna 200 {status: 'ok'} ou 503 {status: 'degraded', checks: {...}}
```

Criar `docs/runbook.md` com: como reiniciar o serviço, como checar `/health`, como ler os logs estruturados, quem contatar se o Supabase cair, como rodar `prisma migrate deploy` em produção com segurança.

**Critério de conclusão:**
- [ ] `GET /health` responde 200 com banco e storage no ar
- [ ] `GET /health` responde 503 se o banco estiver inacessível (testar derrubando a conexão ou mockando)
- [ ] Rate limit ativo em pelo menos as rotas de auth (`/auth/login`, `/auth/signup`)
- [ ] `docs/runbook.md` criado
- [ ] `npm run gate` verde

**Commit sugerido:**
```bash
git add src/server/observability.ts src/server/rateLimit.ts src/server/routes/health.ts docs/runbook.md
git commit -m "feat: observabilidade (otel), rate limit e health check"
```

---

## Fase 9 — Wire com o frontend

**Objetivo:** frontend consumindo a API real, sem mocks, com os testes existentes (unitários e E2E) ainda verdes.

1. Localizar todos os pontos do frontend que hoje usam dados mockados/estado local simulando backend (catálogo, favoritos, pedidos, auth) e substituir pelas chamadas HTTP reais criadas nas Fases 4–6.
2. Rodar a suíte E2E existente (`npm run test:e2e`) e confirmar que passa contra o backend real (ajustar fixtures/seed de banco de teste conforme necessário, nunca contra o banco de produção).
3. Destravar qualquer `describe.skip` relacionado ao painel admin que dependia de backend real.
4. Rodar o gate completo:

```bash
npm run gate
```

**Critério de conclusão:**
- [ ] Nenhum mock de dado remanescente no frontend para as telas cobertas pelas Fases 4–6
- [ ] `npm run test:e2e` verde, incluindo os casos de admin antes marcados `.skip`
- [ ] `npm run check:bundle` dentro do limite de 330 kB
- [ ] `npm run gate` verde de ponta a ponta

**Commit sugerido:**
```bash
git add -A
git commit -m "feat: liga frontend a API real, remove mocks, destrava describe.skip do admin"
```

---

## Gate final

Antes de considerar o backend pronto para revisão/merge, confirme TODOS os itens abaixo:

- [ ] `npm run lint` — 0 erros
- [ ] `npm run typecheck` — 0 erros
- [ ] `npm run test:unit` — todos verdes, incluindo os **273 testes originais do frontend** mais os novos testes de backend
- [ ] `npm run test:e2e` — todos verdes, sem `.skip` não justificado
- [ ] `npm run check:bundle` — bundle do frontend ≤ 330 kB
- [ ] `npx prisma migrate status` — sem migração pendente
- [ ] `GET /health` — responde 200 em ambiente local apontando para o Supabase real
- [ ] `docs/runbook.md` atualizado e refletindo o estado atual do sistema
- [ ] `README.md` atualizado: como rodar o backend localmente, variáveis de ambiente necessárias, como rodar migrações
- [ ] Nenhum segredo (`service_role`, senha de banco, etc.) commitado em nenhum arquivo versionado

Só depois de todos os itens marcados, abrir PR de `feat/backend-mvp` para `main` (ou pedir instrução ao usuário sobre merge direto, conforme convenção já usada no projeto).

## Se algo falhar

- **Pare imediatamente.** Não avance para a próxima fase com um teste vermelho, `typecheck` quebrado, ou lint com erro.
- **Reporte o erro completo** (comando rodado, saída de erro, arquivo/linha quando aplicável) — não resuma nem omita a mensagem original.
- **Não tente contornar com atalho inseguro:** nada de `--force`, `--skip-generate`, comentar teste que falha, usar `any` para silenciar o compilador, ou `migrate reset` para "resolver rápido" um conflito de schema.
- Se a causa raiz não for óbvia em até duas tentativas de investigação, pare e explique ao usuário o que foi tentado e o que ainda está incerto — não insista sozinho indefinidamente.
- Qualquer operação destrutiva no banco (reset, drop, truncate) exige confirmação explícita do usuário antes de rodar, mesmo em ambiente de desenvolvimento.
