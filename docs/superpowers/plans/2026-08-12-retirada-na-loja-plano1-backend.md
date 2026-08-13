# Retirada na Loja — Plano 1 (Backend + Painel do Lojista) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend completo (schema + rotas) para retirada na loja, mais o toggle no painel do lojista para habilitar/desabilitar retirada com endereço — entregável e testável de ponta a ponta via API, mesmo sem o checkout do comprador ainda saber usar essa capacidade (isso é o Plano 2).

**Architecture:** `Store` ganha `address` (texto livre, reaproveitando o campo que já existe no formulário do cliente mas nunca foi salvo no backend) e `pickupAvailable` (mesmo padrão de `giftWrapAvailable`). `Order` ganha `isPickup` e `addressId` vira opcional. `POST /orders` aceita `pickupStoreIds: string[]` — lojas do carrinho escolhidas para retirada não exigem endereço; as demais continuam exigindo, exatamente como hoje.

**Tech Stack:** Hono + Prisma + Postgres (Supabase); React + hooks customizados no painel do lojista.

## Global Constraints

- TypeScript estrito.
- Retirada é opt-in por loja — `Store.pickupAvailable` começa `false`, exige `address` preenchido para ser ligada (validado no cliente E no servidor).
- `Order.isPickup=true` implica `addressId=null` — nunca os dois preenchidos nem os dois ausentes de forma inconsistente com o resultado esperado.
- Migration real via `prisma migrate diff --from-schema <antes> --to-schema prisma/schema.prisma --script` (método usado no fluxo de notificações, Task 1 daquele plano — evita o drift-check do `migrate dev` contra o banco de dev, que ainda carrega tabelas órfãs não rastreadas de investigações anteriores). Aplicar via `prisma db execute` e registrar com `prisma migrate resolve --applied`.
- Testes de rota seguem o padrão de integração já usado no repo (`app.request(...)` contra o banco real, fixtures via `src/server/test/authFixtures.ts`).
- Este plano NÃO toca o checkout do comprador (`src/components/cart/`, `useCartCheckoutState.ts`, `useMarketplaceState.handleFinalizePurchase`) — isso é o Plano 2. `api.createOrder` ganha a capacidade de enviar `pickupStoreIds`, mas nada na UI ainda a usa até o Plano 2.

---

### Task 1: Modelo Prisma + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_store_pickup/migration.sql`

**Interfaces:**
- Produces: `Store.address: string | null`, `Store.pickupAvailable: boolean` (default `false`); `Order.isPickup: boolean` (default `false`), `Order.addressId: string | null` (era obrigatório).

- [ ] **Step 1: Editar o schema**

Em `prisma/schema.prisma`, no `model Store`, adicionar (junto dos outros campos opcionais, antes de `giftWrapAvailable`):

```prisma
  /** Endereço físico da loja, texto livre — exibido quando pickupAvailable. */
  address String?

  /** Loja aceita retirada presencial do pedido. */
  pickupAvailable Boolean @default(false)
```

No `model Order`, adicionar `isPickup` e tornar `addressId`/`address` opcionais:

```prisma
  addressId   String?
  address     Address?    @relation(fields: [addressId], references: [id])
```

(substituindo as linhas atuais `addressId String` / `address Address @relation(...)`)

E adicionar, junto dos outros campos do Item 8 (`isGift`, `giftRecipientName`, `giftMessage`):

```prisma
  /** Pedido retirado na loja em vez de entregue — addressId fica nulo quando true. */
  isPickup Boolean @default(false)
```

- [ ] **Step 2: Gerar a migration via diff schema-a-schema**

```bash
git show HEAD:prisma/schema.prisma > prisma/schema-before.prisma
npx prisma migrate diff --from-schema prisma/schema-before.prisma --to-schema prisma/schema.prisma --script > prisma/add-pickup.sql
```

Remover a primeira linha (`Loaded Prisma config...`) do arquivo antes de aplicar:

```bash
sed -n '2,$p' prisma/add-pickup.sql > prisma/add-pickup.clean.sql
cat prisma/add-pickup.clean.sql
```

Expected: SQL contendo `ALTER TABLE "stores" ADD COLUMN "address" ..., ADD COLUMN "pickupAvailable" ...`, `ALTER TABLE "orders" ADD COLUMN "isPickup" ..., ALTER COLUMN "addressId" DROP NOT NULL`. Nenhum `DROP`/`CREATE TABLE` — é só uma alteração incremental.

- [ ] **Step 3: Aplicar e registrar**

```bash
npx prisma db execute --file prisma/add-pickup.clean.sql
mkdir -p prisma/migrations/20260813120000_add_store_pickup
cp prisma/add-pickup.clean.sql prisma/migrations/20260813120000_add_store_pickup/migration.sql
npx prisma migrate resolve --applied 20260813120000_add_store_pickup
npx prisma migrate status
```

Expected: `Database schema is up to date!`. Se o `migrate status` acusar drift não relacionado a este SQL, PARE e escale — não é esperado que este plano precise reconciliar mais nada (o fluxo de notificações já reconciliou o drift conhecido do banco de dev).

- [ ] **Step 4: Gerar client e verificar**

```bash
npx prisma generate
npx tsc --noEmit
rm prisma/schema-before.prisma prisma/add-pickup.sql prisma/add-pickup.clean.sql
```

Expected: `tsc` limpo (nada usa os campos novos ainda).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): adiciona Store.address/pickupAvailable e Order.isPickup"
```

---

### Task 2: Backend — `stores.ts` aceita endereço e retirada

**Files:**
- Modify: `src/server/routes/stores.ts:48-56` (createStoreSchema), `:58-71` (updateStoreSchema), `:74-102` (toPublicStore), `:117-162` (POST /stores), `:205-246` (PATCH /stores/:id)
- Modify: `src/server/routes/stores.test.ts`

**Interfaces:**
- Produces: `POST /stores` e `PATCH /stores/:id` aceitam `address?: string`, `pickupAvailable?: boolean` no body; resposta (`toPublicStore`) inclui `address: string | null`, `pickupAvailable: boolean`.

- [ ] **Step 1: Escrever os testes (falha esperada)**

Em `src/server/routes/stores.test.ts`, dentro do `describe('POST /stores', ...)`, adicionar (segue o padrão do arquivo: cada teste cria seu próprio fixture/token via `createFixtureUser`, helper `uniqueSlug`):

```ts
  it('rejeita pickupAvailable=true sem endereco (400)', async () => {
    const fixture = await createFixtureUser('STORE_OWNER')
    createdAuthUserIds.push(fixture.authUserId)
    const token = await loginToken(fixture.email, fixture.password)

    const res = await app.request('/stores', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Loja Sem Endereco',
        slug: uniqueSlug('sem-endereco'),
        latitude: -19.92,
        longitude: -43.94,
        pickupAvailable: true,
      }),
    })
    expect(res.status).toBe(400)
  }, 20_000)

  it('aceita address e pickupAvailable=true juntos (201)', async () => {
    const fixture = await createFixtureUser('STORE_OWNER')
    createdAuthUserIds.push(fixture.authUserId)
    const token = await loginToken(fixture.email, fixture.password)
    const slug = uniqueSlug('com-retirada')

    const res = await app.request('/stores', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Loja Com Retirada',
        slug,
        latitude: -19.92,
        longitude: -43.94,
        address: 'Rua das Lojas, 100',
        pickupAvailable: true,
      }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { store: { id: string; address: string | null; pickupAvailable: boolean } }
    expect(body.store.address).toBe('Rua das Lojas, 100')
    expect(body.store.pickupAvailable).toBe(true)
    createdStoreIds.push(body.store.id)
  }, 20_000)
```

Dentro do `describe('PATCH /stores/:id', ...)` já existente no arquivo (`src/server/routes/stores.test.ts:214`), adicionar:

```ts
  it('PATCH liga pickupAvailable sem endereco previo e sem address no body (400)', async () => {
    const fixture = await createFixtureUser('STORE_OWNER')
    createdAuthUserIds.push(fixture.authUserId)
    const token = await loginToken(fixture.email, fixture.password)
    const createRes = await app.request('/stores', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Loja X', slug: uniqueSlug('loja-x'), latitude: -19.92, longitude: -43.94 }),
    })
    const created = (await createRes.json()) as { store: { id: string } }
    createdStoreIds.push(created.store.id)

    const res = await app.request(`/stores/${created.store.id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ pickupAvailable: true }),
    })
    expect(res.status).toBe(400)
  }, 20_000)

  it('PATCH liga pickupAvailable enviando address junto (200)', async () => {
    const fixture = await createFixtureUser('STORE_OWNER')
    createdAuthUserIds.push(fixture.authUserId)
    const token = await loginToken(fixture.email, fixture.password)
    const createRes = await app.request('/stores', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Loja Y', slug: uniqueSlug('loja-y'), latitude: -19.92, longitude: -43.94 }),
    })
    const created = (await createRes.json()) as { store: { id: string } }
    createdStoreIds.push(created.store.id)

    const res = await app.request(`/stores/${created.store.id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ address: 'Av. Central, 50', pickupAvailable: true }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { store: { address: string | null; pickupAvailable: boolean } }
    expect(body.store.address).toBe('Av. Central, 50')
    expect(body.store.pickupAvailable).toBe(true)
  }, 20_000)
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npx vitest run src/server/routes/stores.test.ts
```

Expected: os 4 novos testes falham (campos `address`/`pickupAvailable` ainda não existem nas rotas; a rejeição por falta de endereço ainda não existe, então o 201/400 esperado não bate).

- [ ] **Step 3: Implementar em `stores.ts`**

Substituir `createStoreSchema` (linhas 48-56):

```ts
const createStoreSchema = z.object({
  name: z.string().trim().min(1, 'Nome nao pode ser vazio'),
  slug: slugSchema,
  description: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  category: storeCategorySchema.optional(),
  giftWrapAvailable: z.boolean().optional(),
  address: z.string().trim().optional(),
  pickupAvailable: z.boolean().optional(),
})
```

Substituir `updateStoreSchema` (linhas 58-71):

```ts
const updateStoreSchema = z
  .object({
    name: z.string().trim().min(1, 'Nome nao pode ser vazio'),
    slug: slugSchema,
    description: z.string().optional(),
    latitude: z.number(),
    longitude: z.number(),
    category: storeCategorySchema,
    giftWrapAvailable: z.boolean(),
    address: z.string().trim(),
    pickupAvailable: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Ao menos um campo deve ser informado',
  })
```

Substituir a assinatura e o corpo de `toPublicStore` (linhas 74-102):

```ts
function toPublicStore(store: {
  id: string
  name: string
  slug: string
  description: string | null
  latitude: number
  longitude: number
  category: string
  logoUrl: string | null
  isActive: boolean
  giftWrapAvailable: boolean
  address: string | null
  pickupAvailable: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    description: store.description,
    latitude: store.latitude,
    longitude: store.longitude,
    category: store.category,
    logoUrl: store.logoUrl,
    isActive: store.isActive,
    giftWrapAvailable: store.giftWrapAvailable,
    address: store.address,
    pickupAvailable: store.pickupAvailable,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
  }
}
```

No handler `POST /stores` (linhas 117-162), trocar a linha de destructuring (128) e adicionar a validação logo depois (antes do `findUnique` de slug, linha 130):

```ts
  const { name, slug, description, latitude, longitude, category, giftWrapAvailable, address, pickupAvailable } = parsed.data

  if (pickupAvailable && !address) {
    return c.json({ error: 'Dados invalidos', details: { address: 'Endereço é obrigatório para habilitar retirada' } }, 400)
  }
```

E no `prisma.store.create` (linhas 136-147), adicionar os dois campos:

```ts
    const store = await prisma.store.create({
      data: {
        ownerId: authedUser.id,
        name,
        slug,
        description,
        latitude,
        longitude,
        ...(category !== undefined ? { category } : {}),
        ...(giftWrapAvailable !== undefined ? { giftWrapAvailable } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(pickupAvailable !== undefined ? { pickupAvailable } : {}),
      },
    })
```

No handler `PATCH /stores/:id` (linhas 205-246), trocar a linha de destructuring (229) e adicionar a validação logo depois:

```ts
  const { name, slug, description, latitude, longitude, category, giftWrapAvailable, address, pickupAvailable } = parsed.data

  // pickupAvailable resultante (novo valor ou o que já estava salvo) precisa
  // ter um endereço resultante (novo ou já salvo) — não dá pra ligar retirada
  // sem endereço, nem apagar o endereço de uma loja com retirada ligada.
  const resultingPickupAvailable = pickupAvailable ?? store.pickupAvailable
  const resultingAddress = address ?? store.address
  if (resultingPickupAvailable && !resultingAddress) {
    return c.json({ error: 'Dados invalidos', details: { address: 'Endereço é obrigatório para habilitar retirada' } }, 400)
  }
```

E no `prisma.store.update` (linha ~239-242), adicionar os campos ao `data`:

```ts
    const updated = await prisma.store.update({
      where: { id },
      data: { name, slug, description, latitude, longitude, category, giftWrapAvailable, address, pickupAvailable },
    })
```

- [ ] **Step 4: Rodar e confirmar sucesso**

```bash
npx vitest run src/server/routes/stores.test.ts
```

Expected: PASS — todos os testes, novos e pré-existentes.

- [ ] **Step 5: Commit**

```bash
git add src/server/routes/stores.ts src/server/routes/stores.test.ts
git commit -m "feat(pickup): loja aceita endereco e pickupAvailable em POST/PATCH /stores"
```

---

### Task 3: Backend — `orders.ts` aceita `pickupStoreIds`

**Files:**
- Modify: `src/server/routes/orders.ts:34-47` (schema), `:59-86` (validação de addressId), `:119-181` (agrupamento + transação)
- Modify: `src/server/routes/orders.test.ts`

**Interfaces:**
- Consumes: `Store.pickupAvailable`/`Store.address` (Task 2).
- Produces: `POST /orders` aceita `pickupStoreIds?: string[]` no body; `addressId` vira opcional; cada `Order` criado com `isPickup`/`addressId` corretos por loja.

- [ ] **Step 1: Escrever os testes (falha esperada)**

Em `src/server/routes/orders.test.ts`, dentro do `describe('POST /orders', ...)` (mesmas fixtures compartilhadas `buyerFixture`/`ownerFixture`/`buyerToken`, helpers `createStoreFixture()`, `createProductFixture(storeId, opts)`, `createAddressFixture(userId)`, arrays `createdStoreIds`/`createdProductIds`/`createdAddressIds`/`createdOrderIds` já existentes no arquivo), adicionar:

```ts
    it('pickupStoreIds cria Order com isPickup=true e addressId nulo (sem exigir endereco)', async () => {
      const store = await createStoreFixture()
      createdStoreIds.push(store.id)
      await prisma.store.update({ where: { id: store.id }, data: { pickupAvailable: true, address: 'Rua Teste, 1' } })
      const product = await createProductFixture(store.id, { stock: 5, priceCents: 1000 })
      createdProductIds.push(product.id)

      const res = await app.request('/orders', {
        method: 'POST',
        headers: { authorization: `Bearer ${buyerToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: product.id, quantity: 1 }],
          pickupStoreIds: [store.id],
        }),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { orders: Array<{ id: string; isPickup: boolean; addressId: string | null }> }
      createdOrderIds.push(...body.orders.map((o) => o.id))
      expect(body.orders).toHaveLength(1)
      expect(body.orders[0]!.isPickup).toBe(true)
      expect(body.orders[0]!.addressId).toBeNull()
    }, 20_000)

    it('pickupStoreIds numa loja sem pickupAvailable retorna 400', async () => {
      const store = await createStoreFixture()
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id, { stock: 5, priceCents: 1000 })
      createdProductIds.push(product.id)

      const res = await app.request('/orders', {
        method: 'POST',
        headers: { authorization: `Bearer ${buyerToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: product.id, quantity: 1 }],
          pickupStoreIds: [store.id],
        }),
      })
      expect(res.status).toBe(400)
    }, 20_000)

    it('loja fora de pickupStoreIds sem addressId retorna 400 (endereco obrigatorio)', async () => {
      const store = await createStoreFixture()
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id, { stock: 5, priceCents: 1000 })
      createdProductIds.push(product.id)

      const res = await app.request('/orders', {
        method: 'POST',
        headers: { authorization: `Bearer ${buyerToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: product.id, quantity: 1 }],
        }),
      })
      expect(res.status).toBe(400)
    }, 20_000)

    it('carrinho misto: uma loja com pickup e outra com entrega cria 1 Order de cada tipo', async () => {
      const pickupStore = await createStoreFixture()
      createdStoreIds.push(pickupStore.id)
      await prisma.store.update({ where: { id: pickupStore.id }, data: { pickupAvailable: true, address: 'Rua Teste, 2' } })
      const pickupProduct = await createProductFixture(pickupStore.id, { stock: 5, priceCents: 1000 })
      createdProductIds.push(pickupProduct.id)

      const deliveryStore = await createStoreFixture()
      createdStoreIds.push(deliveryStore.id)
      const deliveryProduct = await createProductFixture(deliveryStore.id, { stock: 5, priceCents: 2000 })
      createdProductIds.push(deliveryProduct.id)

      const address = await createAddressFixture(buyerFixture.user.id)
      createdAddressIds.push(address.id)

      const res = await app.request('/orders', {
        method: 'POST',
        headers: { authorization: `Bearer ${buyerToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [
            { productId: pickupProduct.id, quantity: 1 },
            { productId: deliveryProduct.id, quantity: 1 },
          ],
          addressId: address.id,
          pickupStoreIds: [pickupStore.id],
        }),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { orders: Array<{ id: string; storeId: string; isPickup: boolean; addressId: string | null }> }
      createdOrderIds.push(...body.orders.map((o) => o.id))
      expect(body.orders).toHaveLength(2)
      const pickupOrder = body.orders.find((o) => o.storeId === pickupStore.id)!
      const deliveryOrder = body.orders.find((o) => o.storeId === deliveryStore.id)!
      expect(pickupOrder.isPickup).toBe(true)
      expect(pickupOrder.addressId).toBeNull()
      expect(deliveryOrder.isPickup).toBe(false)
      expect(deliveryOrder.addressId).toBe(address.id)
    }, 20_000)
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npx vitest run src/server/routes/orders.test.ts -t "pickup"
```

Expected: FAIL (addressId ainda obrigatório no schema Zod — request sem `addressId` retorna 400 "Dados invalidos" por falha de schema, não pelo motivo específico que os testes de sucesso esperam; os 400 esperados batem por acidente, os 201 esperados falham).

- [ ] **Step 3: Implementar em `orders.ts`**

Trocar `createOrderSchema` (linhas 34-47):

```ts
const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive('Quantidade deve ser um inteiro positivo'),
      }),
    )
    .nonempty('O carrinho precisa ter ao menos um item'),
  addressId: z.string().min(1).optional(),
  isGift: z.boolean().optional(),
  giftRecipientName: z.string().trim().min(1).optional(),
  giftMessage: z.string().optional(),
  pickupStoreIds: z.array(z.string().min(1)).optional(),
})
```

Trocar a linha de destructuring (linha 60) e a validação de endereço (linhas 80-86) — a validação de endereço precisa mover para DEPOIS do agrupamento por loja (já que agora depende de saber quais lojas exigem entrega). Estrutura completa do handler, do destructuring até o fim do agrupamento (substituindo as linhas 59-128 inteiras):

```ts
  const authedUser = c.get('authedUser')
  const { addressId, isGift, giftRecipientName, giftMessage, pickupStoreIds } = parsed.data
  const pickupStoreIdSet = new Set(pickupStoreIds ?? [])

  // isGift=true exige giftRecipientName (nome de quem vai receber o presente)
  // — checagem manual pois o schema acima trata o campo como opcional para
  // não travar pedidos comuns (isGift ausente/false).
  if (isGift && !giftRecipientName) {
    return c.json({ error: 'Dados invalidos', details: { giftRecipientName: 'Nome de quem vai receber é obrigatório' } }, 400)
  }

  // Consolida entradas duplicadas do mesmo productId somando as quantidades,
  // ANTES de qualquer checagem de estoque ou agrupamento por loja. Sem isso,
  // duas linhas do mesmo produto seriam validadas isoladamente contra o
  // estoque total (cada uma passando a checagem individualmente) mesmo que a
  // soma real excedesse o estoque disponivel.
  const quantityByProductId = new Map<string, number>()
  for (const item of parsed.data.items) {
    quantityByProductId.set(item.productId, (quantityByProductId.get(item.productId) ?? 0) + item.quantity)
  }
  const items = Array.from(quantityByProductId, ([productId, quantity]) => ({ productId, quantity }))

  const productIds = items.map((item) => item.productId)
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
  const productById = new Map(products.map((product) => [product.id, product]))

  for (const item of items) {
    const product = productById.get(item.productId)
    if (!product || !product.isActive) {
      return c.json({ error: 'Produto nao encontrado', productId: item.productId }, 404)
    }
  }

  // Checagem de estoque ANTES da transacao: se algum item nao tiver estoque
  // suficiente, nenhum Order e criado (falha atomica do carrinho inteiro).
  // A transacao abaixo tambem decrementa o estoque de forma condicional
  // (WHERE stock >= quantity via updateMany) para cobrir a corrida entre
  // esta checagem e a escrita — se uma requisicao concorrente esgotar o
  // estoque nesse intervalo, a transacao inteira reverte.
  const insufficientStock = items
    .map((item) => ({ item, product: productById.get(item.productId) }))
    .filter(({ item, product }) => (product?.stock ?? 0) < item.quantity)

  if (insufficientStock.length > 0) {
    return c.json(
      {
        error: 'Estoque insuficiente',
        items: insufficientStock.map(({ item }) => ({ productId: item.productId })),
      },
      409,
    )
  }

  // Agrupa os itens por loja — decisao de design da Fase 6: um carrinho
  // multi-loja gera um Order por loja distinta, nao um Order unico.
  const itemsByStore = new Map<string, Array<{ productId: string; quantity: number; unitPriceCents: number }>>()
  for (const item of items) {
    const product = productById.get(item.productId)
    if (!product) continue
    const existing = itemsByStore.get(product.storeId) ?? []
    existing.push({ productId: item.productId, quantity: item.quantity, unitPriceCents: product.priceCents })
    itemsByStore.set(product.storeId, existing)
  }

  // Retirada (Item 14): valida que toda loja em pickupStoreIds realmente
  // oferece retirada, e que toda loja FORA de pickupStoreIds (que exige
  // entrega) tem um addressId valido do comprador.
  const storeIdsInCart = Array.from(itemsByStore.keys())
  const storesInCart = await prisma.store.findMany({
    where: { id: { in: storeIdsInCart } },
    select: { id: true, pickupAvailable: true },
  })
  const pickupAvailableByStoreId = new Map(storesInCart.map((store) => [store.id, store.pickupAvailable]))

  for (const storeId of pickupStoreIdSet) {
    if (!pickupAvailableByStoreId.get(storeId)) {
      return c.json({ error: 'Uma das lojas selecionadas para retirada nao oferece essa opcao' }, 400)
    }
  }

  const deliveryStoreIds = storeIdsInCart.filter((storeId) => !pickupStoreIdSet.has(storeId))
  if (deliveryStoreIds.length > 0 && !addressId) {
    return c.json({ error: 'Endereco de entrega e obrigatorio para as lojas sem retirada no carrinho' }, 400)
  }

  // Endereco precisa pertencer ao usuario autenticado. 404 tanto se nao
  // existir quanto se for de outro usuario, para nao vazar existencia de
  // endereco alheio. So valida se foi informado — carrinho 100% retirada
  // pode nao mandar addressId.
  if (addressId) {
    const address = await prisma.address.findUnique({ where: { id: addressId } })
    if (!address || address.userId !== authedUser.id) {
      return c.json({ error: 'Endereco nao encontrado' }, 404)
    }
  }
```

Trocar o `order.create` dentro da transação (linhas 156-179 do arquivo original, dentro do `for (const [storeId, storeItems] of itemsByStore)`):

```ts
      const createdOrders = []
      for (const [storeId, storeItems] of itemsByStore) {
        const totalCents = storeItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)
        const isPickup = pickupStoreIdSet.has(storeId)
        const order = await tx.order.create({
          data: {
            buyerId: authedUser.id,
            storeId,
            addressId: isPickup ? null : addressId,
            isPickup,
            totalCents,
            isGift: isGift ?? false,
            giftRecipientName: isGift ? giftRecipientName : undefined,
            giftMessage: isGift ? giftMessage : undefined,
            items: {
              create: storeItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPriceCents: item.unitPriceCents,
              })),
            },
          },
          include: { items: true },
        })
        createdOrders.push(order)
      }
      return createdOrders
```

> Nota: `addressId: isPickup ? null : addressId` é seguro pelo `deliveryStoreIds.length > 0 && !addressId` checado acima — toda loja não-pickup só chega aqui se `addressId` está definido.

- [ ] **Step 4: Rodar e confirmar sucesso**

```bash
npx vitest run src/server/routes/orders.test.ts
```

Expected: PASS — todos os testes, novos e pré-existentes (incluindo os de Task 4/5/6 do fluxo de notificações, que dependem do mesmo handler).

- [ ] **Step 5: Commit**

```bash
git add src/server/routes/orders.ts src/server/routes/orders.test.ts
git commit -m "feat(pickup): POST /orders aceita pickupStoreIds, addressId vira opcional"
```

---

### Task 4: Cliente HTTP — `ApiStore`, `updateStore`, `createOrder`

**Files:**
- Modify: `src/lib/api.ts:75-89` (ApiStore), `:609-615` (createOrder), `:636-647` (updateStore)

**Interfaces:**
- Produces: `ApiStore.address: string | null`, `ApiStore.pickupAvailable: boolean`; `api.updateStore` aceita `address`/`pickupAvailable` no `Partial<>`; `api.createOrder` aceita `addressId?: string` (era obrigatório) e `pickupStoreIds?: string[]`.

- [ ] **Step 1: Atualizar `ApiStore`**

Em `src/lib/api.ts`, no `interface ApiStore` (linhas 75-89), adicionar antes do fechamento:

```ts
  /** Endereço físico da loja, texto livre — presente quando a loja preencheu. */
  address: string | null
  /** Item 14 — loja aceita retirada presencial do pedido. */
  pickupAvailable: boolean
```

- [ ] **Step 2: Atualizar `createOrder`**

Substituir (linhas 609-615):

```ts
  createOrder: (input: {
    items: Array<{ productId: string; quantity: number }>
    addressId?: string
    isGift?: boolean
    giftRecipientName?: string
    giftMessage?: string
    /** Item 14 — ids das lojas do carrinho escolhidas para retirada; as demais exigem addressId. */
    pickupStoreIds?: string[]
  }) => request<{ orders: ApiOrder[] }>('/orders', { method: 'POST', body: input }),
```

- [ ] **Step 3: Atualizar `updateStore`**

Substituir (linhas 636-647):

```ts
  updateStore: (
    storeId: string,
    input: Partial<{
      name: string
      slug: string
      description: string
      latitude: number
      longitude: number
      category: string
      giftWrapAvailable: boolean
      address: string
      pickupAvailable: boolean
    }>,
  ) => request<{ store: ApiStore }>(`/stores/${storeId}`, { method: 'PATCH', body: input }),
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit
```

Expected: limpo — nada consome os campos novos de `ApiStore`/`createOrder`/`updateStore` ainda (a próxima task consome `updateStore`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(pickup): cliente HTTP aceita address/pickupAvailable e pickupStoreIds"
```

---

### Task 5: Painel do lojista — toggle de retirada

**Files:**
- Modify: `src/state/useStoreDashboard.ts:194-211` (depois de `updateGiftWrapAvailable`), `:251-270` (return)
- Modify: `src/screens/store/StoreDashboardScreen.tsx:1-51` (imports/state/handlers), `:194-217` (depois do bloco de `giftWrapAvailable`)
- Modify: `src/test/mocks/handlers.ts:193-212` (`seedStoreOwner`), `:816-825` (`PATCH /api/stores/:id`)
- Test: `src/test/store-dashboard.test.tsx` (arquivo já existe — o `describe('embalagem para presente no painel /minha-loja (Item 9)', ...)` nele, linhas 196-227, é o padrão exato a seguir)

**Interfaces:**
- Consumes: `api.updateStore` (Task 4).
- Produces: `useStoreDashboard(...).updatePickupAvailable(pickupAvailable: boolean, address?: string): Promise<boolean>` — mesmo contrato de `updateGiftWrapAvailable`, com o parâmetro extra opcional de endereço.

- [ ] **Step 1: Atualizar o mock MSW — `ApiStore` ganhou campos obrigatórios**

`ApiStore` (Task 4) agora exige `address`/`pickupAvailable` — sem isso, TODO objeto literal `ApiStore` neste arquivo quebra o typecheck (faltam propriedades obrigatórias). Rodar `npx tsc --noEmit` primeiro para confirmar a lista atual de erros antes de editar — a lista abaixo é a esperada, mas se algo mais aparecer (arquivo mudou desde este plano), tratar da mesma forma (adicionar os dois campos).

Em `src/test/mocks/handlers.ts`, no array `mockStores` (linhas ~45-49, 4 objetos literais `ApiStore`), adicionar `address: null, pickupAvailable: false,` a cada um dos 4 objetos (depois de `giftWrapAvailable: ...`).

No objeto retornado por `seedStoreOwner` (depois de `giftWrapAvailable: false,`, linha ~205), adicionar:

```ts
    address: null,
    pickupAvailable: false,
```

No handler `http.post('/api/stores', ...)` (por volta da linha 780-810 — buscar `const store: ApiStore = {` para achar o ponto exato), adicionar ao tipo do body parseado (perto de `giftWrapAvailable?: boolean` no tipo inline do body):

```ts
      address?: string
      pickupAvailable?: boolean
```

E no objeto `store: ApiStore` construído logo abaixo (perto de `giftWrapAvailable: body.giftWrapAvailable ?? false,` ou equivalente), adicionar:

```ts
      address: body.address ?? null,
      pickupAvailable: body.pickupAvailable ?? false,
```

No handler `http.patch('/api/stores/:id', ...)` (buscar `Object.assign(store, body` para achar o ponto exato), trocar o tipo do `Pick<...>` do body parseado:

```ts
    const body = (await request.json()) as Partial<
      Pick<
        ApiStore,
        'name' | 'slug' | 'description' | 'latitude' | 'longitude' | 'category' | 'giftWrapAvailable' | 'address' | 'pickupAvailable'
      >
    >
```

- [ ] **Step 2: Rodar o typecheck e confirmar que tudo compila**

```bash
npx tsc --noEmit
```

Expected: limpo (nenhum outro lugar usa `pickupAvailable`/`address` ainda, então nada mais deveria falhar).

- [ ] **Step 3: Escrever os testes (falha esperada)**

Em `src/test/store-dashboard.test.tsx`, adicionar um novo `describe`, seguindo exatamente o padrão de `describe('embalagem para presente no painel /minha-loja (Item 9)', ...)` (linhas 196-227: `seedStoreOwner`, `seedLoggedInStorage`, `renderAt`, `screen.findByRole`/`getByRole`, `fireEvent`, `waitFor`):

```ts
describe('retirada na loja no painel /minha-loja (Item 14)', () => {
  it('habilita retirada preenchendo o endereço e clicando em "Habilitar retirada"', async () => {
    const store = seedStoreOwner({ pickupAvailable: false, address: null })
    seedLoggedInStorage()
    renderAt('/minha-loja')

    await screen.findByRole('heading', { name: store.name })
    const addressInput = screen.getByLabelText(/endereço para retirada/i)
    fireEvent.change(addressInput, { target: { value: 'Rua Teste, 1' } })
    fireEvent.click(screen.getByRole('button', { name: /habilitar retirada/i }))

    await waitFor(() => expect(db.myStores[0]?.pickupAvailable).toBe(true))
    expect(db.myStores[0]?.address).toBe('Rua Teste, 1')
  })

  it('não deixa habilitar retirada com o endereço vazio', async () => {
    const store = seedStoreOwner({ pickupAvailable: false, address: null })
    seedLoggedInStorage()
    renderAt('/minha-loja')

    await screen.findByRole('heading', { name: store.name })
    expect(screen.getByRole('button', { name: /habilitar retirada/i })).toBeDisabled()
  })

  it('desativa retirada sem exigir endereço', async () => {
    const store = seedStoreOwner({ pickupAvailable: true, address: 'Rua Já Salva, 5' })
    seedLoggedInStorage()
    renderAt('/minha-loja')

    await screen.findByRole('heading', { name: store.name })
    fireEvent.click(screen.getByRole('button', { name: /desativar retirada/i }))

    await waitFor(() => expect(db.myStores[0]?.pickupAvailable).toBe(false))
  })
})
```

- [ ] **Step 4: Rodar e confirmar falha**

```bash
npx vitest run src/test/store-dashboard.test.tsx
```

Expected: FAIL (nem o input nem os botões existem ainda).

- [ ] **Step 5: Implementar `updatePickupAvailable` em `useStoreDashboard.ts`**

Depois de `updateGiftWrapAvailable` (linha 211), adicionar:

```ts

  /** Item 14 — liga/desliga retirada na loja. Ligar exige `address`; desligar não. */
  const updatePickupAvailable = useCallback(async (pickupAvailable: boolean, address?: string) => {
    if (!store) return false
    setActionError('')
    try {
      const { store: updated } = await api.updateStore(store.id, {
        pickupAvailable,
        ...(address !== undefined ? { address } : {}),
      })
      setStore(updated)
      pushToast(pickupAvailable ? 'Retirada na loja ativada' : 'Retirada na loja desativada', 'success')
      return true
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.status > 0
          ? err.message
          : 'Não foi possível salvar a preferência. Tente novamente.',
      )
      return false
    }
  }, [store])
```

No `return` do hook (linha ~269, depois de `updateGiftWrapAvailable,`), adicionar:

```ts
    updatePickupAvailable,
```

- [ ] **Step 6: Implementar a UI em `StoreDashboardScreen.tsx`**

No topo do arquivo, adicionar ao import de ícones existente (linha 1): trocar `import { Gift, Store as StoreIcon } from 'lucide-react'` por `import { Gift, MapPin, Store as StoreIcon } from 'lucide-react'`.

Depois de `const [giftWrapPending, setGiftWrapPending] = useState(false)` (linha 42), adicionar:

```ts
  const [pickupAddressDraft, setPickupAddressDraft] = useState('')
  const [pickupPending, setPickupPending] = useState(false)
```

Depois de `handleToggleGiftWrap` (linhas 46-51), adicionar:

```ts
  const handleEnablePickup = async () => {
    if (!dashboard.store || !pickupAddressDraft.trim()) return
    setPickupPending(true)
    const ok = await dashboard.updatePickupAvailable(true, pickupAddressDraft.trim())
    if (ok) setPickupAddressDraft('')
    setPickupPending(false)
  }

  const handleDisablePickup = async () => {
    if (!dashboard.store) return
    setPickupPending(true)
    await dashboard.updatePickupAvailable(false)
    setPickupPending(false)
  }
```

Depois do bloco `<div className="mt-4 flex items-center justify-between gap-3 rounded-card border border-line p-4">...</div>` do gift wrap (linhas 195-217), adicionar:

```tsx
        <div className="mt-4 rounded-card border border-line p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <MapPin className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
            Retirada na loja
          </p>
          {dashboard.store.pickupAvailable ? (
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-sm text-ink-muted">Retire em: {dashboard.store.address}</p>
              <button
                type="button"
                onClick={() => void handleDisablePickup()}
                disabled={pickupPending}
                className="min-h-[36px] shrink-0 rounded-[14px] border border-line px-3 text-xs font-semibold text-ink-muted disabled:opacity-60"
              >
                Desativar retirada
              </button>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <label htmlFor="pickup-address" className="sr-only">
                Endereço para retirada
              </label>
              <input
                id="pickup-address"
                value={pickupAddressDraft}
                onChange={(event) => setPickupAddressDraft(event.target.value)}
                placeholder="Endereço da loja"
                className="field-input"
              />
              <button
                type="button"
                onClick={() => void handleEnablePickup()}
                disabled={pickupPending || !pickupAddressDraft.trim()}
                className="min-h-[36px] w-full rounded-[14px] bg-primary px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Habilitar retirada
              </button>
            </div>
          )}
        </div>
```

- [ ] **Step 7: Rodar e confirmar sucesso**

```bash
npx vitest run src/test/store-dashboard.test.tsx
npx tsc --noEmit
```

Expected: PASS; typecheck limpo.

- [ ] **Step 8: Commit**

```bash
git add src/state/useStoreDashboard.ts src/screens/store/StoreDashboardScreen.tsx src/test/mocks/handlers.ts src/test/store-dashboard.test.tsx
git commit -m "feat(pickup): toggle de retirada no painel do lojista"
```

---

### Task 6: Gate final

**Files:** nenhum (apenas verificação).

- [ ] **Step 1: Rodar o gate completo**

```bash
npm run gate
```

Expected: `lint`, `typecheck`, `test:unit`, `build`, `check:bundle` todos passam.

- [ ] **Step 2: Rodar o e2e existente (regressão)**

```bash
npm run test:e2e
```

Expected: os 4 specs já existentes continuam passando — este plano não altera nenhum fluxo de checkout/exibição de pedido que eles exercitam, só adiciona capacidade nova ao backend e ao painel do lojista.

Expected: nenhum e2e novo precisa ser escrito neste plano — o fluxo completo de retirada (comprador escolhendo no checkout) só existe de ponta a ponta depois do Plano 2.
