# Fluxo de Notificações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o painel de notificações (hoje 100% client-side/localStorage) por notificações reais persistidas no Postgres, cobrindo a lacuna existente: o dono de uma loja passa a ser avisado quando um cliente faz um pedido nela.

**Architecture:** Um helper único (`createNotification`) chamado diretamente nas rotas Hono que já mutam estado (`POST /orders`, `POST /stores`, webhook de pagamento) — sem event bus. Duas rotas novas (`GET /me/notifications`, `POST /me/notifications/read`) servem o painel. No front, um hook de polling (`useRemoteNotifications`) substitui a geração local de notificações de sucesso; erros transitórios continuam como toast apenas.

**Tech Stack:** Hono + Prisma + Postgres (Supabase) no backend; React + hook customizado no frontend. Sem infra nova (sem WebSocket/Realtime/fila).

## Global Constraints

- TypeScript estrito em tudo — sem `any` não justificado.
- Falha ao criar uma notificação NUNCA pode derrubar a operação principal (pedido/loja continuam criados mesmo se a notificação falhar) — sempre `try/catch` com log, nunca propagar.
- Notificações de erro transitório de UI (favoritar falhou, cadastro de loja falhou) são toast-only — não persistem no banco (fora de escopo, ver spec).
- Sem paginação por cursor: o painel é um popover pequeno, `take: 50` mais recentes é suficiente (não existe padrão de "carregar mais" em nenhum outro lugar do app).
- Migration real via `prisma migrate dev` — a tabela `notifications` órfã existente no banco de dev é dropada antes, para a migration criar a versão oficial sem conflito.
- Testes de rota seguem o padrão de integração já usado no repo (`app.request(...)` contra o banco real de teste, fixtures via `src/server/test/authFixtures.ts`) — não mockar Prisma nessas rotas. `paymentService.test.ts` já mocka Prisma por completo (estilo unitário) — seguir esse padrão só nesse arquivo específico.

---

### Task 1: Modelo Prisma + migration (dropar tabela órfã, criar oficial)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260812180000_add_notifications/migration.sql` (gerado pelo comando, não escrito à mão)
- Create temporário (apagar depois de rodar): `prisma/drop-orphan-notifications.sql`

**Interfaces:**
- Produces: `model Notification` no Prisma Client (`prisma.notification.create/findMany/count/updateMany`), enum `NotificationType` (`INFO | SUCCESS | WARNING`), campo `User.notifications: Notification[]` (relação inversa).

- [ ] **Step 1: Dropar a tabela órfã no banco de dev antes de gerar a migration**

Criar `prisma/drop-orphan-notifications.sql`:

```sql
DROP TABLE IF EXISTS "notifications" CASCADE;
```

Rodar (usa `.env.local`/`DIRECT_URL` automaticamente via `prisma.config.ts`):

```bash
npx prisma db execute --file prisma/drop-orphan-notifications.sql
```

Expected: comando termina sem erro (`Script executed successfully`).

- [ ] **Step 2: Apagar o SQL temporário**

```bash
rm prisma/drop-orphan-notifications.sql
```

- [ ] **Step 3: Adicionar o enum e o model ao schema**

Em `prisma/schema.prisma`, logo após o enum `StoreCategory` (linha 35) e antes de `model User`:

```prisma
enum NotificationType {
  INFO
  SUCCESS
  WARNING
}
```

No `model User` (linhas 37-56), adicionar a relação inversa junto das outras (depois de `reviews Review[]`):

```prisma
  notifications Notification[]
```

Ao final do arquivo, adicionar o novo model:

```prisma
model Notification {
  id        String            @id @default(uuid())
  userId    String
  user      User              @relation(fields: [userId], references: [id])
  title     String
  message   String
  type      NotificationType  @default(INFO)
  href      String?
  isRead    Boolean           @default(false)
  createdAt DateTime          @default(now())

  @@index([userId, createdAt])
  @@map("notifications")
}
```

- [ ] **Step 4: Gerar e aplicar a migration**

```bash
npx prisma migrate dev --name add_notifications
```

Expected: cria `prisma/migrations/20260812<hhmmss>_add_notifications/migration.sql` com `CREATE TYPE "NotificationType"...` e `CREATE TABLE "notifications"...`, aplica com sucesso, roda `prisma generate` automaticamente. Se o Prisma perguntar sobre drift (não deveria, já que a tabela foi dropada no Step 1), responder para prosseguir com a criação normal — não resetar o banco.

- [ ] **Step 5: Verificar que o client gerado expõe o novo model**

```bash
npx tsc --noEmit
```

Expected: sem erros (o schema novo ainda não é usado em nenhum código, então isso só confirma que `prisma generate` rodou certo).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): adiciona model Notification e dropa tabela orfa nao versionada"
```

---

### Task 2: Helper `createNotification` + teste

**Files:**
- Create: `src/server/lib/notifications.ts`
- Test: `src/server/lib/notifications.test.ts`

**Interfaces:**
- Consumes: `prisma` de `./prismaClient` (mesmo cliente usado em todas as rotas).
- Produces: `createNotification(userId: string, input: { title: string; message: string; type?: NotificationType; href?: string }): Promise<void>` — usado pelas Tasks 4, 5 e 6.

- [ ] **Step 1: Escrever o teste (falha esperada — módulo ainda não existe)**

Criar `src/server/lib/notifications.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from './prismaClient'
import { createNotification } from './notifications'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

describe('createNotification', () => {
  let userFixture: Awaited<ReturnType<typeof createFixtureUser>>

  it('cria a notificação com os campos informados', async () => {
    userFixture = await createFixtureUser('BUYER')
    try {
      await createNotification(userFixture.user.id, {
        title: 'Título teste',
        message: 'Mensagem teste',
        type: 'SUCCESS',
        href: '/pedidos',
      })

      const created = await prisma.notification.findFirst({
        where: { userId: userFixture.user.id },
      })
      expect(created).not.toBeNull()
      expect(created?.title).toBe('Título teste')
      expect(created?.message).toBe('Mensagem teste')
      expect(created?.type).toBe('SUCCESS')
      expect(created?.href).toBe('/pedidos')
      expect(created?.isRead).toBe(false)
    } finally {
      await prisma.notification.deleteMany({ where: { userId: userFixture.user.id } })
      await deleteFixtureUser(userFixture.authUserId)
    }
  }, 20_000)

  it('type é opcional e usa INFO como padrão', async () => {
    const fixture = await createFixtureUser('BUYER')
    try {
      await createNotification(fixture.user.id, { title: 'T', message: 'M' })
      const created = await prisma.notification.findFirst({ where: { userId: fixture.user.id } })
      expect(created?.type).toBe('INFO')
    } finally {
      await prisma.notification.deleteMany({ where: { userId: fixture.user.id } })
      await deleteFixtureUser(fixture.authUserId)
    }
  }, 20_000)

  it('nao lanca erro se a escrita falhar (userId inexistente = violação de FK)', async () => {
    await expect(
      createNotification('00000000-0000-0000-0000-000000000000', {
        title: 'T',
        message: 'M',
      }),
    ).resolves.toBeUndefined()

    const count = await prisma.notification.count({
      where: { userId: '00000000-0000-0000-0000-000000000000' },
    })
    expect(count).toBe(0)
  }, 20_000)
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run src/server/lib/notifications.test.ts
```

Expected: FAIL — `Cannot find module './notifications'`.

- [ ] **Step 3: Implementar o helper**

Criar `src/server/lib/notifications.ts`:

```ts
import { prisma } from './prismaClient'
import type { NotificationType } from '@prisma/client'

/**
 * Cria uma notificação persistida para um usuário. Chamada direto de dentro
 * das rotas que geram o evento (pedido criado, loja criada, pagamento
 * confirmado) — sem event bus, mesmo padrão do resto do backend.
 *
 * NUNCA lança: uma falha aqui não pode derrubar a operação principal que a
 * originou (o pedido/loja já foi criado com sucesso quando isto é chamado).
 */
export async function createNotification(
  userId: string,
  input: { title: string; message: string; type?: NotificationType; href?: string },
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        title: input.title,
        message: input.message,
        type: input.type ?? 'INFO',
        href: input.href,
      },
    })
  } catch (error) {
    console.error('Falha ao criar notificação', { userId, title: input.title, error })
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx vitest run src/server/lib/notifications.test.ts
```

Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/server/lib/notifications.ts src/server/lib/notifications.test.ts
git commit -m "feat(notifications): adiciona helper createNotification"
```

---

### Task 3: Rotas `GET /me/notifications` e `POST /me/notifications/read`

**Files:**
- Create: `src/server/routes/notifications.ts`
- Test: `src/server/routes/notifications.test.ts`
- Modify: `src/server/app.ts`

**Interfaces:**
- Consumes: `createNotification` (Task 2, usado só no teste para popular fixtures — a rota em si só lê/atualiza), `requireUser`/`AuthEnv` de `../middleware/auth`.
- Produces: `GET /me/notifications` → `{ notifications: Array<{ id: string; title: string; message: string; type: 'info'|'success'|'warning'; href: string | null; isRead: boolean; createdAt: number }>; unreadCount: number }`; `POST /me/notifications/read` → `{ ok: true }`. Consumidos pela Task 7 (`src/lib/api.ts`).

- [ ] **Step 1: Escrever o teste**

Criar `src/server/routes/notifications.test.ts`:

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

describe('rotas de notificacoes', () => {
  let buyerFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let otherBuyerFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let buyerToken: string
  let otherBuyerToken: string

  beforeAll(async () => {
    buyerFixture = await createFixtureUser('BUYER')
    otherBuyerFixture = await createFixtureUser('BUYER')
    buyerToken = await loginToken(buyerFixture.email, buyerFixture.password)
    otherBuyerToken = await loginToken(otherBuyerFixture.email, otherBuyerFixture.password)
  }, 30_000)

  afterAll(async () => {
    await Promise.all([
      deleteFixtureUser(buyerFixture.authUserId),
      deleteFixtureUser(otherBuyerFixture.authUserId),
    ])
  })

  afterEach(async () => {
    await prisma.notification.deleteMany({
      where: { userId: { in: [buyerFixture.user.id, otherBuyerFixture.user.id] } },
    })
  })

  const loginToken = async (email: string, password: string) => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = (await res.json()) as { session: { accessToken: string } }
    return body.session.accessToken
  }

  describe('GET /me/notifications', () => {
    it('lista somente as notificacoes do proprio usuario, mais recentes primeiro', async () => {
      await prisma.notification.create({
        data: { userId: buyerFixture.user.id, title: 'Mais antiga', message: 'M1', type: 'INFO' },
      })
      await prisma.notification.create({
        data: { userId: buyerFixture.user.id, title: 'Mais nova', message: 'M2', type: 'SUCCESS' },
      })
      await prisma.notification.create({
        data: { userId: otherBuyerFixture.user.id, title: 'De outro usuario', message: 'M3', type: 'INFO' },
      })

      const res = await app.request('/me/notifications', {
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        notifications: Array<{ title: string; type: string; isRead: boolean }>
        unreadCount: number
      }
      expect(body.notifications.map((n) => n.title)).toEqual(['Mais nova', 'Mais antiga'])
      expect(body.notifications.every((n) => n.type === n.type.toLowerCase())).toBe(true)
      expect(body.unreadCount).toBe(2)
    }, 20_000)

    it('401 sem token', async () => {
      const res = await app.request('/me/notifications')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /me/notifications/read', () => {
    it('marca todas as notificacoes do usuario como lidas (idempotente)', async () => {
      await prisma.notification.create({
        data: { userId: buyerFixture.user.id, title: 'A', message: 'M', type: 'INFO' },
      })
      await prisma.notification.create({
        data: { userId: buyerFixture.user.id, title: 'B', message: 'M', type: 'INFO' },
      })

      const first = await app.request('/me/notifications/read', {
        method: 'POST',
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(first.status).toBe(200)

      const afterFirst = await app.request('/me/notifications', {
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      const afterFirstBody = (await afterFirst.json()) as { unreadCount: number }
      expect(afterFirstBody.unreadCount).toBe(0)

      const second = await app.request('/me/notifications/read', {
        method: 'POST',
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(second.status).toBe(200)
    }, 20_000)

    it('nao afeta notificacoes de outro usuario', async () => {
      await prisma.notification.create({
        data: { userId: otherBuyerFixture.user.id, title: 'A', message: 'M', type: 'INFO' },
      })

      await app.request('/me/notifications/read', {
        method: 'POST',
        headers: { authorization: `Bearer ${buyerToken}` },
      })

      const res = await app.request('/me/notifications', {
        headers: { authorization: `Bearer ${otherBuyerToken}` },
      })
      const body = (await res.json()) as { unreadCount: number }
      expect(body.unreadCount).toBe(1)
    }, 20_000)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run src/server/routes/notifications.test.ts
```

Expected: FAIL (404 — rota não existe / `app.request` retorna 404 nas chamadas).

- [ ] **Step 3: Implementar as rotas**

Criar `src/server/routes/notifications.ts`:

```ts
import { Hono } from 'hono'
import { prisma } from '../lib/prismaClient'
import { requireUser, type AuthEnv } from '../middleware/auth'

export const notificationRoutes = new Hono<AuthEnv>()

const NOTIFICATIONS_LIMIT = 50

notificationRoutes.get('/me/notifications', requireUser, async (c) => {
  const authedUser = c.get('authedUser')

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: authedUser.id },
      orderBy: { createdAt: 'desc' },
      take: NOTIFICATIONS_LIMIT,
    }),
    prisma.notification.count({ where: { userId: authedUser.id, isRead: false } }),
  ])

  return c.json({
    notifications: notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type.toLowerCase() as 'info' | 'success' | 'warning',
      href: notification.href,
      isRead: notification.isRead,
      createdAt: notification.createdAt.getTime(),
    })),
    unreadCount,
  })
})

/** Idempotente: marcar como lida de novo nao e erro, so um no-op. */
notificationRoutes.post('/me/notifications/read', requireUser, async (c) => {
  const authedUser = c.get('authedUser')
  await prisma.notification.updateMany({
    where: { userId: authedUser.id, isRead: false },
    data: { isRead: true },
  })
  return c.json({ ok: true })
})
```

- [ ] **Step 4: Registrar as rotas em `app.ts`**

Em `src/server/app.ts`, adicionar o import junto dos outros (depois de `paymentRoutes`):

```ts
import { notificationRoutes } from './routes/notifications'
```

E a linha de registro (depois de `app.route('/', paymentRoutes)`):

```ts
app.route('/', notificationRoutes)
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

```bash
npx vitest run src/server/routes/notifications.test.ts
```

Expected: PASS (5 testes).

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/notifications.ts src/server/routes/notifications.test.ts src/server/app.ts
git commit -m "feat(notifications): adiciona GET /me/notifications e POST /me/notifications/read"
```

---

### Task 4: Notificar comprador e dono(s) da loja ao criar pedido

**Files:**
- Modify: `src/server/routes/orders.ts:138-193`
- Modify: `src/server/routes/orders.test.ts`

**Interfaces:**
- Consumes: `createNotification` (Task 2), `formatCents` de `../../lib/money`.

- [ ] **Step 1: Escrever o teste (falha esperada)**

Em `src/server/routes/orders.test.ts`, dentro do `describe('POST /orders', ...)` já existente (mesmo arquivo, mesmas fixtures de loja/produto/comprador já usadas nos outros testes desse describe — replicar o setup local de cada teste vizinho), adicionar:

```ts
  it('notifica o comprador e o dono da loja apos criar o pedido', async () => {
    const store = await createStoreFixture()
    createdStoreIds.push(store.id)
    const product = await createProductFixture(store.id, { priceCents: 5000, stock: 10 })
    createdProductIds.push(product.id)
    const address = await createAddressFixture(buyerFixture.user.id)
    createdAddressIds.push(address.id)

    const res = await app.request('/orders', {
      method: 'POST',
      headers: { authorization: `Bearer ${buyerToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 2 }],
        addressId: address.id,
      }),
    })
    expect(res.status).toBe(201)

    const buyerNotification = await prisma.notification.findFirst({
      where: { userId: buyerFixture.user.id, title: 'Pedido confirmado' },
    })
    expect(buyerNotification).not.toBeNull()
    expect(buyerNotification?.type).toBe('SUCCESS')
    expect(buyerNotification?.href).toBe('/pedidos')

    const ownerNotification = await prisma.notification.findFirst({
      where: { userId: ownerFixture.user.id, title: 'Novo pedido recebido' },
    })
    expect(ownerNotification).not.toBeNull()
    // `formatCents` usa Intl.NumberFormat pt-BR, que insere um espaço NBSP
    // (não um espaço comum) antes do valor — ver o mesmo cuidado em
    // `src/lib/money.test.ts`. Checar só o valor numérico evita depender
    // desse detalhe de encoding.
    expect(ownerNotification?.message).toContain('100,00')
    expect(ownerNotification?.href).toBe('/minha-loja')

    await prisma.notification.deleteMany({
      where: { userId: { in: [buyerFixture.user.id, ownerFixture.user.id] } },
    })
  }, 20_000)
```

Este teste usa as fixtures compartilhadas já declaradas no `beforeAll` do arquivo (`buyerFixture`, `ownerFixture`, `buyerToken`) e os helpers já existentes (`createStoreFixture()`, `createProductFixture(storeId, { priceCents, stock })`, `createAddressFixture(userId)`, arrays `createdStoreIds`/`createdProductIds`/`createdAddressIds` — ver linhas 12-102 do arquivo, reproduzidas acima em "Interfaces").

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run src/server/routes/orders.test.ts -t "notifica o comprador"
```

Expected: FAIL — nenhuma notificação encontrada (`buyerNotification` é `null`).

- [ ] **Step 3: Implementar a notificação em `orders.ts`**

No topo de `src/server/routes/orders.ts`, adicionar aos imports (depois da linha 5):

```ts
import { createNotification } from '../lib/notifications'
import { formatCents } from '../../lib/money'
```

Substituir o bloco final do handler `POST /orders` (linhas 180-181, dentro do `try`, logo depois do `$transaction`):

```ts
    return c.json({ orders }, 201)
```

por:

```ts
    // Notificacoes best-effort: nunca bloqueiam nem revertem a resposta —
    // o pedido ja foi criado com sucesso quando chegamos aqui.
    await createNotification(authedUser.id, {
      title: 'Pedido confirmado',
      message:
        orders.length > 1
          ? `Seus ${orders.length} pedidos foram confirmados (um por loja).`
          : 'Pedido confirmado! Acompanhe em Meus pedidos.',
      type: 'SUCCESS',
      href: '/pedidos',
    })

    const stores = await prisma.store.findMany({
      where: { id: { in: orders.map((order) => order.storeId) } },
      select: { id: true, ownerId: true },
    })
    const ownerIdByStoreId = new Map(stores.map((store) => [store.id, store.ownerId]))
    await Promise.all(
      orders.map((order) => {
        const ownerId = ownerIdByStoreId.get(order.storeId)
        if (!ownerId) return Promise.resolve()
        return createNotification(ownerId, {
          title: 'Novo pedido recebido',
          message: `Novo pedido de ${formatCents(order.totalCents)}.`,
          type: 'INFO',
          href: '/minha-loja',
        })
      }),
    )

    return c.json({ orders }, 201)
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx vitest run src/server/routes/orders.test.ts
```

Expected: PASS — inclui o novo teste e todos os que já existiam nesse arquivo (checagem de não-regressão).

- [ ] **Step 5: Commit**

```bash
git add src/server/routes/orders.ts src/server/routes/orders.test.ts
git commit -m "feat(notifications): notifica comprador e lojista ao criar pedido"
```

---

### Task 5: Notificar dono da loja ao criar a loja

**Files:**
- Modify: `src/server/routes/stores.ts:134-153`
- Modify: `src/server/routes/stores.test.ts`

**Interfaces:**
- Consumes: `createNotification` (Task 2).

- [ ] **Step 1: Escrever o teste (falha esperada)**

Em `src/server/routes/stores.test.ts`, dentro do `describe('POST /stores', ...)` já existente, adicionar (este arquivo NÃO usa fixtures compartilhadas de `beforeAll` — cada teste cria seu próprio `fixture`/`token` inline via `createFixtureUser`, e o helper de slug único se chama `uniqueSlug`, não `unique` — seguir exatamente o padrão do teste `'STORE_OWNER cria loja com sucesso'` já presente no arquivo):

```ts
  it('notifica o dono apos criar a loja', async () => {
    const fixture = await createFixtureUser('STORE_OWNER')
    createdAuthUserIds.push(fixture.authUserId)
    const token = await loginToken(fixture.email, fixture.password)
    const slug = uniqueSlug('notificacao')

    const res = await app.request('/stores', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Loja Notificacao Teste',
        slug,
        latitude: -19.92,
        longitude: -43.94,
      }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { store: { id: string } }
    createdStoreIds.push(body.store.id)

    const notification = await prisma.notification.findFirst({
      where: { userId: fixture.user.id, title: 'Loja criada' },
    })
    expect(notification).not.toBeNull()
    expect(notification?.type).toBe('SUCCESS')
    expect(notification?.href).toBe('/minha-loja')

    await prisma.notification.deleteMany({ where: { userId: fixture.user.id } })
  }, 20_000)
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run src/server/routes/stores.test.ts -t "notifica o dono"
```

Expected: FAIL — `notification` é `null`.

- [ ] **Step 3: Implementar a notificação em `stores.ts`**

No topo de `src/server/routes/stores.ts`, adicionar aos imports (depois da linha 5):

```ts
import { createNotification } from '../lib/notifications'
```

Substituir o retorno de sucesso do handler `POST /stores` (linha 147):

```ts
    return c.json({ store: toPublicStore(store) }, 201)
```

por:

```ts
    await createNotification(authedUser.id, {
      title: 'Loja criada',
      message: `${store.name} já está no Primeiro Aqui. Publique seus produtos!`,
      type: 'SUCCESS',
      href: '/minha-loja',
    })

    return c.json({ store: toPublicStore(store) }, 201)
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx vitest run src/server/routes/stores.test.ts
```

Expected: PASS — inclui o novo teste e todos os que já existiam.

- [ ] **Step 5: Commit**

```bash
git add src/server/routes/stores.ts src/server/routes/stores.test.ts
git commit -m "feat(notifications): notifica dono da loja apos criacao"
```

---

### Task 6: Notificar comprador quando o pagamento é confirmado (webhook Pagar.me)

**Files:**
- Modify: `src/server/lib/paymentService.ts:420-457`
- Modify: `src/server/lib/paymentService.test.ts`

**Interfaces:**
- Consumes: `createNotification` (Task 2) — mockado neste arquivo (estilo unitário já usado aqui, ver Global Constraints).

- [ ] **Step 1: Escrever o teste (falha esperada)**

Em `src/server/lib/paymentService.test.ts`, adicionar ao mock do topo do arquivo (linha 8-13), incluir `findFirst` no mock de `order`:

```ts
vi.mock('./prismaClient', () => ({
  prisma: {
    store: { update: vi.fn(), updateMany: vi.fn() },
    order: { update: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
  },
}))

vi.mock('./notifications', () => ({ createNotification: vi.fn() }))
```

Adicionar aos imports (linha 15-26):

```ts
import { createNotification } from './notifications'
```

Dentro do `describe('handleWebhook', ...)`, no `beforeEach` (linhas 472-475), resetar também os novos mocks:

```ts
  beforeEach(() => {
    vi.mocked(prisma.order.updateMany).mockReset()
    vi.mocked(prisma.order.findFirst).mockReset()
    vi.mocked(prisma.store.updateMany).mockReset()
    vi.mocked(createNotification).mockReset()
  })
```

Adicionar os novos casos de teste, dentro do mesmo `describe('handleWebhook', ...)` (depois do teste `'order.paid -> paymentStatus PAID'`):

```ts
  it('order.paid notifica o comprador na primeira confirmacao', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      buyerId: 'buyer_1',
      paymentStatus: 'PENDING',
    } as never)
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 })

    await handleWebhook({ type: 'order.paid', data: { order: { id: 'ord_1' } } })

    expect(createNotification).toHaveBeenCalledWith('buyer_1', {
      title: 'Pagamento confirmado',
      message: 'Pagamento confirmado! Acompanhe em Meus pedidos.',
      type: 'SUCCESS',
      href: '/pedidos',
    })
  })

  it('order.paid reaplicado (ja estava PAID) nao notifica de novo', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      buyerId: 'buyer_1',
      paymentStatus: 'PAID',
    } as never)
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 })

    await handleWebhook({ type: 'order.paid', data: { order: { id: 'ord_1' } } })

    expect(createNotification).not.toHaveBeenCalled()
  })

  it('order.paid sem pedido correspondente nao notifica', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 0 })

    await handleWebhook({ type: 'order.paid', data: { order: { id: 'ord_inexistente' } } })

    expect(createNotification).not.toHaveBeenCalled()
  })

  it('order.payment_failed nao notifica (so PAID notifica)', async () => {
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 })
    await handleWebhook({ type: 'order.payment_failed', data: { order: { id: 'ord_1' } } })
    expect(createNotification).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
npx vitest run src/server/lib/paymentService.test.ts -t "notifica"
```

Expected: FAIL — `createNotification` nunca é chamado (a lógica ainda não existe) e/ou `prisma.order.findFirst` não é mockável ainda (não usado pelo código).

- [ ] **Step 3: Implementar a notificação em `handleWebhook`**

No topo de `src/server/lib/paymentService.ts`, adicionar ao import existente (linha 1):

```ts
import { prisma } from './prismaClient'
import { createNotification } from './notifications'
```

Substituir o final da função `handleWebhook` (linhas 447-457):

```ts
  const nextStatus = ORDER_EVENT_TO_STATUS[event.type]
  if (!nextStatus) return // inclui charge.chargedback (deprecado) e eventos nao mapeados

  const pagarmeOrderId = event.data.order?.id ?? event.data.id
  if (!pagarmeOrderId) return

  await prisma.order.updateMany({
    where: { pagarmeOrderId },
    data: { paymentStatus: nextStatus },
  })
}
```

por:

```ts
  const nextStatus = ORDER_EVENT_TO_STATUS[event.type]
  if (!nextStatus) return // inclui charge.chargedback (deprecado) e eventos nao mapeados

  const pagarmeOrderId = event.data.order?.id ?? event.data.id
  if (!pagarmeOrderId) return

  // Le o pedido ANTES de atualizar para saber se essa e a PRIMEIRA vez que
  // ele vira PAID — reaplicar o mesmo webhook (idempotencia, ver comentario
  // da funcao) nao pode notificar o comprador de novo a cada replay.
  const before =
    nextStatus === 'PAID'
      ? await prisma.order.findFirst({
          where: { pagarmeOrderId },
          select: { buyerId: true, paymentStatus: true },
        })
      : null

  const result = await prisma.order.updateMany({
    where: { pagarmeOrderId },
    data: { paymentStatus: nextStatus },
  })

  if (nextStatus === 'PAID' && result.count > 0 && before && before.paymentStatus !== 'PAID') {
    await createNotification(before.buyerId, {
      title: 'Pagamento confirmado',
      message: 'Pagamento confirmado! Acompanhe em Meus pedidos.',
      type: 'SUCCESS',
      href: '/pedidos',
    })
  }
}
```

- [ ] **Step 4: Rodar todos os testes do arquivo e confirmar que passam**

```bash
npx vitest run src/server/lib/paymentService.test.ts
```

Expected: PASS — todos os testes, incluindo os pré-existentes (`order.paid -> paymentStatus PAID`, `idempotente: reaplicar o mesmo evento...`, etc.) continuam passando sem alteração no comportamento de `updateMany`.

- [ ] **Step 5: Commit**

```bash
git add src/server/lib/paymentService.ts src/server/lib/paymentService.test.ts
git commit -m "feat(notifications): notifica comprador quando pagamento e confirmado"
```

---

### Task 7: Cliente HTTP — `listNotifications` / `markNotificationsRead`

**Files:**
- Modify: `src/lib/api.ts`

**Interfaces:**
- Consumes: `request<T>` (helper existente em `api.ts`).
- Produces: `ApiNotification` (tipo), `api.listNotifications(): Promise<{ notifications: ApiNotification[]; unreadCount: number }>`, `api.markNotificationsRead(): Promise<{ ok: true }>`. Consumidos pela Task 9.

- [ ] **Step 1: Adicionar o DTO**

Em `src/lib/api.ts`, logo depois da interface `ApiStore` (linha 89, antes da linha 90 em branco que seguia), adicionar:

```ts
export interface ApiNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning'
  href: string | null
  isRead: boolean
  /** Epoch ms. */
  createdAt: number
}
```

- [ ] **Step 2: Adicionar os métodos ao objeto `api`**

Logo depois de `listFavorites` (linha 555, antes da linha em branco seguida de `createAddress`), adicionar:

```ts
  listNotifications: () =>
    request<{ notifications: ApiNotification[]; unreadCount: number }>('/me/notifications'),

  markNotificationsRead: () => request<{ ok: true }>('/me/notifications/read', { method: 'POST' }),

```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

Expected: sem erros (nada consome esses métodos ainda).

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(notifications): adiciona listNotifications e markNotificationsRead ao cliente HTTP"
```

---

### Task 8: `Notification.id` vira `string` (alinhar com uuid do backend)

**Files:**
- Modify: `src/types/index.ts:204-213`

**Interfaces:**
- Produces: `Notification.id: string` (era `number`) — consumido por `NotificationsPanel.tsx` (só usa como React `key`, sem alteração necessária lá) e pela Task 9/10.

- [ ] **Step 1: Alterar o tipo**

Em `src/types/index.ts`, trocar:

```ts
export interface Notification {
  id: number
```

por:

```ts
export interface Notification {
  id: string
```

- [ ] **Step 2: Rodar o typecheck para achar todo uso quebrado**

```bash
npx tsc --noEmit
```

Expected: aponta os pontos que ainda tratam `id` como `number` — nas Tasks 9 e 10 esses pontos são corrigidos (o `addNotification` atual em `useCatalogState.ts`, que faz `id: prev.length + 1`, é removido/substituído na Task 10, não corrigido aqui). Se o typecheck falhar em algum lugar fora do que as Tasks 9/10 cobrem, anotar e resolver na Task 10 antes do commit final dela.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "refactor(notifications): Notification.id vira string (uuid do backend)"
```

---

### Task 9: Hook `useRemoteNotifications` (polling)

**Files:**
- Create: `src/state/useRemoteNotifications.ts`
- Test: `src/state/useRemoteNotifications.test.ts`

**Interfaces:**
- Consumes: `api.listNotifications`, `api.markNotificationsRead` (Task 7), `ApiError` de `../lib/api`.
- Produces: `useRemoteNotifications(enabled: boolean): { notifications: Notification[]; unreadCount: number; markRead: () => void }`. Consumido pela Task 10.

- [ ] **Step 1: Escrever o teste**

Criar `src/state/useRemoteNotifications.test.ts`:

```ts
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRemoteNotifications } from './useRemoteNotifications'
import { api } from '../lib/api'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return { ...actual, api: { ...actual.api, listNotifications: vi.fn(), markNotificationsRead: vi.fn() } }
})

const listNotificationsMock = vi.mocked(api.listNotifications)
const markNotificationsReadMock = vi.mocked(api.markNotificationsRead)

describe('useRemoteNotifications', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('nao busca nada quando enabled=false', async () => {
    renderHook(() => useRemoteNotifications(false))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(listNotificationsMock).not.toHaveBeenCalled()
  })

  it('busca ao montar e expoe notifications/unreadCount', async () => {
    listNotificationsMock.mockResolvedValue({
      notifications: [
        { id: '1', title: 'T', message: 'M', type: 'info', href: null, isRead: false, createdAt: 1000 },
      ],
      unreadCount: 1,
    })

    const { result } = renderHook(() => useRemoteNotifications(true))

    await waitFor(() => expect(result.current.notifications).toHaveLength(1))
    expect(result.current.unreadCount).toBe(1)
  })

  it('markRead chama a API e zera unreadCount otimisticamente', async () => {
    listNotificationsMock.mockResolvedValue({
      notifications: [
        { id: '1', title: 'T', message: 'M', type: 'info', href: null, isRead: false, createdAt: 1000 },
      ],
      unreadCount: 1,
    })
    markNotificationsReadMock.mockResolvedValue({ ok: true })

    const { result } = renderHook(() => useRemoteNotifications(true))
    await waitFor(() => expect(result.current.unreadCount).toBe(1))

    act(() => {
      result.current.markRead()
    })

    expect(result.current.unreadCount).toBe(0)
    await waitFor(() => expect(markNotificationsReadMock).toHaveBeenCalledTimes(1))
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run src/state/useRemoteNotifications.test.ts
```

Expected: FAIL — `Cannot find module './useRemoteNotifications'`.

- [ ] **Step 3: Implementar o hook**

Criar `src/state/useRemoteNotifications.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Notification } from '../types'

/** Intervalo de polling do painel de notificações. */
const POLL_INTERVAL_MS = 30_000

/**
 * Notificações reais: GET /me/notifications ao montar, a cada
 * `POLL_INTERVAL_MS` e quando a aba volta a ficar visível. `enabled=false`
 * (sem sessão) não busca nada — mesmo padrão de `useAddressesState`.
 */
export function useRemoteNotifications(enabled: boolean) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    if (!enabled) return
    try {
      const { notifications: dtos, unreadCount: count } = await api.listNotifications()
      setNotifications(
        dtos.map((dto) => ({
          id: dto.id,
          title: dto.title,
          message: dto.message,
          type: dto.type,
          href: dto.href ?? undefined,
          createdAt: dto.createdAt,
        })),
      )
      setUnreadCount(count)
    } catch {
      // Silencioso: notificações são conveniência, não bloqueiam o app.
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    void fetchNotifications()
    const interval = setInterval(() => void fetchNotifications(), POLL_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void fetchNotifications()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, fetchNotifications])

  const markRead = useCallback(() => {
    setUnreadCount(0)
    api.markNotificationsRead().catch(() => {
      // Silencioso: pior caso, o contador reaparece na próxima busca.
    })
  }, [])

  return { notifications, unreadCount, markRead }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx vitest run src/state/useRemoteNotifications.test.ts
```

Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/state/useRemoteNotifications.ts src/state/useRemoteNotifications.test.ts
git commit -m "feat(notifications): adiciona hook useRemoteNotifications com polling"
```

---

### Task 10: Ligar o hook ao app — remover geração local de notificações de sucesso

**Files:**
- Modify: `src/state/useCatalogState.ts`
- Modify: `src/state/useMarketplaceState.ts`
- Modify: `src/state/session.ts` (remover chave de storage não mais usada)

**Interfaces:**
- Consumes: `useRemoteNotifications` (Task 9).
- Produces: `useMarketplaceState()` continua expondo `notifications`, `notificationCount`, `onNotificationsOpen` com o mesmo formato que `NotificationsPanel.tsx` já consome — nenhuma mudança de props no componente.

- [ ] **Step 1: Remover a geração local de notificações em `useCatalogState.ts`**

Reescrever `src/state/useCatalogState.ts` inteiro:

```ts
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'wouter'

import { readStoredJSON } from '../lib/storage'
import { STORAGE_KEYS } from './session'
import { initialThreads } from './marketplaceSeed'
import type { Product, Thread } from '../types'

/** Busca, favoritos e mensagens exibidas na vitrine. Notificações vêm de `useRemoteNotifications`. */
export function useCatalogState() {
  const [searchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '')

  // A URL e a fonte de verdade do termo buscado: abrir /busca?q=x por link
  // precisa preencher o campo, senao o deep link mostra resultado sem contexto.
  useEffect(() => {
    setSearchQuery(searchParams.get('q') ?? '')
  }, [searchParams])
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [favorites, setFavorites] = useState<Product[]>(() =>
    readStoredJSON<Product[]>(STORAGE_KEYS.favorites, []),
  )
  const [messageThreads, setMessageThreads] = useState<Thread[]>(() =>
    readStoredJSON(STORAGE_KEYS.messages, initialThreads),
  )

  const toggleFavorite = (product: Product) => {
    setFavorites((prev) =>
      prev.some((item) => item.id === product.id)
        ? prev.filter((item) => item.id !== product.id)
        : [...prev, product],
    )
  }

  return {
    searchQuery,
    setSearchQuery,
    searchInputRef,
    favorites,
    setFavorites,
    toggleFavorite,
    messageThreads,
    setMessageThreads,
  }
}
```

Isso remove `initialNotifications` de `marketplaceSeed.ts` — deixar essa constante lá por enquanto não quebra nada (arquivo de seed local), mas ela fica sem uso; remover a constante `initialNotifications` e seu export de `src/state/marketplaceSeed.ts` nesta mesma tarefa (Step 1b abaixo) para não deixar código morto.

**Step 1b:** em `src/state/marketplaceSeed.ts`, remover a constante `initialNotifications` e seu `export` (grep o arquivo por `initialNotifications` para localizar a declaração exata antes de remover — é a única mudança nesse arquivo).

- [ ] **Step 2: Ligar `useRemoteNotifications` em `useMarketplaceState.ts`**

Em `src/state/useMarketplaceState.ts`, adicionar o import (junto dos outros hooks de estado, depois da linha `import { useAddressesState } from './useAddressesState'`):

```ts
import { useRemoteNotifications } from './useRemoteNotifications'
```

Depois da linha `const addresses = useAddressesState(!!session.authUser)` (linha 53), adicionar:

```ts
  const remoteNotifications = useRemoteNotifications(hasSession)
```

> Atenção: `hasSession` é declarado na linha 65 (`const hasSession = !!session.authUser`), DEPOIS da linha 53 — mover a declaração de `hasSession` para logo antes de `addresses` (ou reusar `!!session.authUser` diretamente aqui, já que `session.authUser` já existe nesse ponto) para não depender de uma variável ainda não declarada. Usar `useRemoteNotifications(!!session.authUser)` neste ponto e manter a declaração de `hasSession` mais abaixo como está (ela é só um alias reaproveitado no resto do arquivo).

- [ ] **Step 3: Remover a persistência local de notificações**

Em `src/state/useMarketplaceState.ts`, remover o efeito (linhas 206-208):

```ts
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.notifications, catalog.notifications)
  }, [catalog.notifications])
```

- [ ] **Step 4: Remover as chamadas de sucesso a `catalog.addNotification` e trocar erros por `pushToast`**

Em `dropLocalSession` (linha 190), remover a linha `catalog.setMessageThreads(initialThreads)` **não** — essa fica (é sobre mensagens, não notificações). Não há chamada de `addNotification` dentro de `dropLocalSession`; pular este ponto.

Em `notifyFavoriteError` (linhas 277-282), trocar:

```ts
  const notifyFavoriteError = (err: unknown) =>
    catalog.addNotification(
      'Favoritos',
      apiErrorMessage(err, 'Não foi possível atualizar seus favoritos.'),
      'warning',
    )
```

por:

```ts
  const notifyFavoriteError = (err: unknown) =>
    pushToast(apiErrorMessage(err, 'Não foi possível atualizar seus favoritos.'), 'error')
```

Em `handleBecomeStoreOwner` (linhas 490-497), trocar:

```ts
    } catch (err) {
      catalog.addNotification(
        'Cadastro de lojista',
        apiErrorMessage(err, 'Não foi possível iniciar seu cadastro de lojista. Tente novamente.'),
        'warning',
        ROUTES.profile,
      )
    }
```

por:

```ts
    } catch (err) {
      pushToast(apiErrorMessage(err, 'Não foi possível iniciar seu cadastro de lojista. Tente novamente.'), 'error')
    }
```

Em `handleBusinessSetupSubmit`, remover a chamada de sucesso (linhas 537-542):

```ts
      admin.setBusinessProfile({ ...admin.setupForm, name: created.store.name })
      admin.setIsSetupOpen(false)
      catalog.addNotification(
        'Loja criada',
        `${created.store.name} já está no Primeiro Aqui. Publique seus produtos!`,
        'success',
        ROUTES.myStore,
      )
      navigate(ROUTES.myStore)
```

por (o servidor já cria a notificação — Task 5):

```ts
      admin.setBusinessProfile({ ...admin.setupForm, name: created.store.name })
      admin.setIsSetupOpen(false)
      pushToast(`${created.store.name} já está no Primeiro Aqui. Publique seus produtos!`, 'success')
      navigate(ROUTES.myStore)
```

E o catch de erro (linhas 544-549):

```ts
    } catch (err) {
      catalog.addNotification(
        'Cadastro do negócio',
        apiErrorMessage(err, 'Não foi possível criar sua loja. Tente novamente.'),
        'warning',
      )
    }
```

por:

```ts
    } catch (err) {
      pushToast(apiErrorMessage(err, 'Não foi possível criar sua loja. Tente novamente.'), 'error')
    }
```

Em `handleFinalizePurchase`, remover a chamada de sucesso (linhas 655-662):

```ts
        catalog.addNotification(
          'Compra confirmada',
          orders.length > 1
            ? `Seus ${orders.length} pedidos foram confirmados (um por loja).`
            : 'Pedido confirmado! Acompanhe em Meus pedidos.',
          'success',
          ROUTES.orders,
        )
        closeCheckoutDrawer()
```

por (o servidor já cria a notificação — Task 4; o toast de feedback imediato continua):

```ts
        pushToast(
          orders.length > 1
            ? `Seus ${orders.length} pedidos foram confirmados (um por loja).`
            : 'Pedido confirmado! Acompanhe em Meus pedidos.',
          'success',
        )
        closeCheckoutDrawer()
```

Em `finishCheckoutAfterPayment` (linhas 690-701), remover a chamada de sucesso — o toast `pushToast('Pagamento confirmado!', 'success')` já existe logo abaixo e cobre o feedback imediato; o servidor cria a notificação persistida (Task 6):

```ts
  const finishCheckoutAfterPayment = () => {
    catalog.addNotification(
      'Compra confirmada',
      payment.totalPayments > 1
        ? `Seus ${payment.totalPayments} pedidos foram pagos (um por loja).`
        : 'Pagamento confirmado! Acompanhe em Meus pedidos.',
      'success',
      ROUTES.orders,
    )
    pushToast('Pagamento confirmado!', 'success')
    payment.resetPayment()
    closeCheckoutDrawer()
  }
```

por:

```ts
  const finishCheckoutAfterPayment = () => {
    pushToast('Pagamento confirmado!', 'success')
    payment.resetPayment()
    closeCheckoutDrawer()
  }
```

- [ ] **Step 5: Trocar a fonte de `notifications`/`notificationCount`/`onNotificationsOpen` no retorno do hook**

No objeto retornado por `useMarketplaceState` (linhas 779-781), trocar:

```ts
    notifications: catalog.notifications,
    notificationCount: catalog.unreadCount,
    onNotificationsOpen: catalog.markNotificationsRead,
```

por:

```ts
    notifications: remoteNotifications.notifications,
    notificationCount: remoteNotifications.unreadCount,
    onNotificationsOpen: remoteNotifications.markRead,
```

- [ ] **Step 6: Remover a chave de storage não mais usada**

Em `src/state/session.ts`, remover `notifications: 'primeiroaqui_notifications',` do objeto `STORAGE_KEYS`.

- [ ] **Step 7: Rodar o typecheck e os testes unitários**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: typecheck limpo (nenhuma referência sobrando a `catalog.addNotification`, `catalog.notifications`, `catalog.unreadCount`, `catalog.markNotificationsRead`, `STORAGE_KEYS.notifications`); toda a suíte unitária passa.

- [ ] **Step 8: Testar manualmente no navegador**

```bash
npm run dev:server &
npm run dev
```

No navegador: logar como comprador, favoritar um produto sem estar logado (deve continuar redirecionando/toast normalmente), fazer login como lojista de dev (atalho de login rápido), abrir o sino de notificações — deve aparecer vazio ou com notificações reais vindas do backend (sem erro no console). Confirmar que o contador do sino soma corretamente e some ao abrir o painel.

- [ ] **Step 9: Commit**

```bash
git add src/state/useCatalogState.ts src/state/useMarketplaceState.ts src/state/session.ts src/state/marketplaceSeed.ts
git commit -m "feat(notifications): liga useRemoteNotifications, remove geracao local de sucesso"
```

---

### Task 11: E2E — lojista vê notificação de novo pedido após compra do cliente

**Files:**
- Modify: `e2e/jornada-lojista.spec.ts:85-91`

**Interfaces:**
- Nenhuma nova — usa a UI existente (`NotificationsPanel`, sino no `TopBar`, `aria-label` dinâmico `` `Notificações${notificationCount ? `, ${notificationCount} não lidas` : ''}` `` — ver `src/components/TopBar.tsx:283`).

O spec já tem um teste único (`'lojista cadastra negócio, publica produto e recebe pedido'`) que cobre: lojista cria loja e publica produto → comprador (segundo contexto de navegador) compra o produto com cartão → volta ao contexto do lojista, recarrega e confirma que o pedido aparece na aba "Pedidos". Esse é exatamente o cenário que dispara a notificação da Task 4 (`POST /orders` cria "Novo pedido recebido" para o dono da loja). Basta inserir a verificação do sino logo depois que o pedido já está confirmado como visível — a página já foi recarregada nesse ponto (`merchantPage.reload()`), o que dispara a busca inicial do `useRemoteNotifications` no mount, sem precisar de `page.waitForTimeout`.

- [ ] **Step 1: Inserir a verificação do sino**

Em `e2e/jornada-lojista.spec.ts`, entre a linha 90 (`await expect(orderItem).toBeVisible({ timeout: 15000 })`) e a linha 92 (comentário `// Avança o status do pedido.`), inserir:

```ts

  // Sino de notificações: o dono da loja é avisado do pedido novo assim que
  // ele é criado (POST /orders, ver src/server/routes/orders.ts).
  await merchantPage.getByRole('button', { name: /notifica/i }).click()
  await expect(merchantPage.getByText('Novo pedido recebido')).toBeVisible({ timeout: 10000 })
  await merchantPage.getByRole('button', { name: /fechar/i }).click()
```

O trecho resultante (linhas 85-97) fica:

```ts
  // Volta ao contexto do lojista: pedido deve aparecer em "Pedidos".
  await merchantPage.getByRole('tab', { name: /^pedidos$/i }).click()
  await merchantPage.reload()
  await merchantPage.getByRole('tab', { name: /^pedidos$/i }).click()
  const orderItem = merchantPage.getByText(buyerName).first()
  await expect(orderItem).toBeVisible({ timeout: 15000 })

  // Sino de notificações: o dono da loja é avisado do pedido novo assim que
  // ele é criado (POST /orders, ver src/server/routes/orders.ts).
  await merchantPage.getByRole('button', { name: /notifica/i }).click()
  await expect(merchantPage.getByText('Novo pedido recebido')).toBeVisible({ timeout: 10000 })
  await merchantPage.getByRole('button', { name: /fechar/i }).click()

  // Avança o status do pedido.
  const advanceButton = merchantPage.getByRole('button', { name: /confirmar pedido/i }).first()
```

- [ ] **Step 2: Rodar o e2e**

```bash
npm run test:e2e -- jornada-lojista
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/jornada-lojista.spec.ts
git commit -m "test(e2e): lojista ve notificacao de novo pedido apos compra do cliente"
```

---

### Task 12: Gate final

**Files:** nenhum (apenas verificação).

- [ ] **Step 1: Rodar o gate completo**

```bash
npm run gate
```

Expected: `lint`, `typecheck`, `test:unit`, `build` e `check:bundle` todos passam sem erro.

- [ ] **Step 2: Rodar o e2e completo**

```bash
npm run test:e2e
```

Expected: todos os specs passam, incluindo `jornada-lojista.spec.ts` com o novo teste da Task 11.

- [ ] **Step 3: Se tudo passou, revisar o diff completo antes de finalizar**

```bash
git log --oneline b61b660..HEAD
git diff b61b660..HEAD --stat
```

Expected: só os arquivos listados nas Tasks 1-11, nenhuma mudança acidental fora do escopo.
