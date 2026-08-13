import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

/**
 * Mesmo padrao de fixtures compartilhadas de `productPhotos.test.ts` —
 * usuarios fixture criados uma vez em `beforeAll`, reaproveitados entre
 * casos, para nao estourar o rate-limit do Supabase Auth.
 */
describe('rotas de pedidos (checkout)', () => {
  const createdStoreIds: string[] = []
  const createdProductIds: string[] = []
  const createdAddressIds: string[] = []
  const createdOrderIds: string[] = []

  let buyerFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let otherBuyerFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let ownerFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let buyerToken: string
  let otherBuyerToken: string

  beforeAll(async () => {
    buyerFixture = await createFixtureUser('BUYER')
    otherBuyerFixture = await createFixtureUser('BUYER')
    ownerFixture = await createFixtureUser('STORE_OWNER')
    buyerToken = await loginToken(buyerFixture.email, buyerFixture.password)
    otherBuyerToken = await loginToken(otherBuyerFixture.email, otherBuyerFixture.password)
  }, 30_000)

  afterAll(async () => {
    await Promise.all([
      deleteFixtureUser(buyerFixture.authUserId),
      deleteFixtureUser(otherBuyerFixture.authUserId),
      deleteFixtureUser(ownerFixture.authUserId),
    ])
  })

  afterEach(async () => {
    await prisma.notification.deleteMany({
      where: { userId: { in: [buyerFixture.user.id, otherBuyerFixture.user.id, ownerFixture.user.id] } },
    })
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } })
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } })
    createdOrderIds.length = 0
    await prisma.address.deleteMany({ where: { id: { in: createdAddressIds } } })
    createdAddressIds.length = 0
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } })
    createdProductIds.length = 0
    await prisma.store.deleteMany({ where: { id: { in: createdStoreIds } } })
    createdStoreIds.length = 0
  })

  const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const loginToken = async (email: string, password: string) => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = (await res.json()) as { session: { accessToken: string } }
    return body.session.accessToken
  }

  const createStoreFixture = async () =>
    prisma.store.create({
      data: {
        ownerId: ownerFixture.user.id,
        name: 'Loja Teste Fase 6',
        slug: unique('teste-fase6-checkout-loja'),
        latitude: -23.55,
        longitude: -46.63,
        isActive: true,
      },
    })

  const createProductFixture = async (
    storeId: string,
    overrides: Partial<{ stock: number; priceCents: number; isActive: boolean }> = {},
  ) =>
    prisma.product.create({
      data: {
        storeId,
        title: 'Produto Teste Fase 6',
        category: unique('categoria'),
        priceCents: overrides.priceCents ?? 1000,
        stock: overrides.stock ?? 10,
        isActive: overrides.isActive ?? true,
      },
    })

  const createAddressFixture = async (userId: string) =>
    prisma.address.create({
      data: {
        userId,
        label: 'Casa',
        street: 'Rua Teste, 123',
        city: 'Sao Paulo',
        state: 'SP',
        zipCode: '01000-000',
        latitude: -23.55,
        longitude: -46.63,
      },
    })

  describe('POST /orders', () => {
    it('checkout com estoque suficiente cria 1 Order (1 loja)', async () => {
      const store = await createStoreFixture()
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id, { stock: 5, priceCents: 1000 })
      createdProductIds.push(product.id)
      const address = await createAddressFixture(buyerFixture.user.id)
      createdAddressIds.push(address.id)

      const res = await app.request('/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          items: [{ productId: product.id, quantity: 3 }],
          addressId: address.id,
        }),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as {
        orders: Array<{ id: string; storeId: string; totalCents: number; items: Array<{ quantity: number }> }>
      }
      createdOrderIds.push(...body.orders.map((o) => o.id))
      expect(body.orders).toHaveLength(1)
      expect(body.orders[0]?.storeId).toBe(store.id)
      expect(body.orders[0]?.totalCents).toBe(3000)

      const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } })
      expect(updatedProduct?.stock).toBe(2)
    }, 20_000)

    it('checkout com produtos de 2 lojas diferentes gera 2 Orders', async () => {
      const storeA = await createStoreFixture()
      const storeB = await createStoreFixture()
      createdStoreIds.push(storeA.id, storeB.id)
      const productA = await createProductFixture(storeA.id, { stock: 5, priceCents: 1000 })
      const productB = await createProductFixture(storeB.id, { stock: 5, priceCents: 2000 })
      createdProductIds.push(productA.id, productB.id)
      const address = await createAddressFixture(buyerFixture.user.id)
      createdAddressIds.push(address.id)

      const res = await app.request('/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          items: [
            { productId: productA.id, quantity: 1 },
            { productId: productB.id, quantity: 2 },
          ],
          addressId: address.id,
        }),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as {
        orders: Array<{ id: string; storeId: string; totalCents: number }>
      }
      createdOrderIds.push(...body.orders.map((o) => o.id))
      expect(body.orders).toHaveLength(2)
      const storeIds = body.orders.map((o) => o.storeId).sort()
      expect(storeIds).toEqual([storeA.id, storeB.id].sort())

      const orderA = body.orders.find((o) => o.storeId === storeA.id)
      const orderB = body.orders.find((o) => o.storeId === storeB.id)
      expect(orderA?.totalCents).toBe(1000) // productA: 1 x 1000
      expect(orderB?.totalCents).toBe(4000) // productB: 2 x 2000

      const productAAfter = await prisma.product.findUnique({ where: { id: productA.id } })
      const productBAfter = await prisma.product.findUnique({ where: { id: productB.id } })
      expect(productAAfter?.stock).toBe(4) // 5 - 1
      expect(productBAfter?.stock).toBe(3) // 5 - 2
    }, 20_000)

    it('checkout com estoque insuficiente falha por completo (409, nenhum Order criado, estoque intacto)', async () => {
      const store = await createStoreFixture()
      createdStoreIds.push(store.id)
      const plentiful = await createProductFixture(store.id, { stock: 10 })
      const scarce = await createProductFixture(store.id, { stock: 1 })
      createdProductIds.push(plentiful.id, scarce.id)
      const address = await createAddressFixture(buyerFixture.user.id)
      createdAddressIds.push(address.id)

      const res = await app.request('/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          items: [
            { productId: plentiful.id, quantity: 2 },
            { productId: scarce.id, quantity: 5 },
          ],
          addressId: address.id,
        }),
      })
      expect(res.status).toBe(409)

      const ordersCount = await prisma.order.count({ where: { buyerId: buyerFixture.user.id, storeId: store.id } })
      expect(ordersCount).toBe(0)

      const plentifulAfter = await prisma.product.findUnique({ where: { id: plentiful.id } })
      const scarceAfter = await prisma.product.findUnique({ where: { id: scarce.id } })
      expect(plentifulAfter?.stock).toBe(10)
      expect(scarceAfter?.stock).toBe(1)
    }, 20_000)

    it('checkout com addressId de outro usuario falha (404, nao vaza existencia)', async () => {
      const store = await createStoreFixture()
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)
      const otherAddress = await createAddressFixture(otherBuyerFixture.user.id)
      createdAddressIds.push(otherAddress.id)

      const res = await app.request('/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          items: [{ productId: product.id, quantity: 1 }],
          addressId: otherAddress.id,
        }),
      })
      expect(res.status).toBe(404)

      const ordersCount = await prisma.order.count({ where: { buyerId: buyerFixture.user.id } })
      expect(ordersCount).toBe(0)
    }, 20_000)

    it('produto inexistente ou inativo recebe 404, nenhum Order criado', async () => {
      const store = await createStoreFixture()
      createdStoreIds.push(store.id)
      const inactiveProduct = await createProductFixture(store.id, { isActive: false })
      createdProductIds.push(inactiveProduct.id)
      const address = await createAddressFixture(buyerFixture.user.id)
      createdAddressIds.push(address.id)

      const res = await app.request('/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          items: [{ productId: inactiveProduct.id, quantity: 1 }],
          addressId: address.id,
        }),
      })
      expect(res.status).toBe(404)
    }, 20_000)

    it('duas compras concorrentes do mesmo produto com stock=1: exatamente uma 201 e uma 409, stock final 0', async () => {
      const store = await createStoreFixture()
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id, { stock: 1 })
      createdProductIds.push(product.id)
      const address = await createAddressFixture(buyerFixture.user.id)
      const otherAddress = await createAddressFixture(otherBuyerFixture.user.id)
      createdAddressIds.push(address.id, otherAddress.id)

      const makeRequest = (token: string, addressId: string) =>
        app.request('/orders', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ items: [{ productId: product.id, quantity: 1 }], addressId }),
        })

      const [resA, resB] = await Promise.all([
        makeRequest(buyerToken, address.id),
        makeRequest(otherBuyerToken, otherAddress.id),
      ])

      const statuses = [resA.status, resB.status].sort()
      expect(statuses).toEqual([201, 409])

      const bodies = await Promise.all([resA.json(), resB.json()])
      for (const [index, status] of [resA.status, resB.status].entries()) {
        if (status === 201) {
          const body = bodies[index] as { orders: Array<{ id: string }> }
          createdOrderIds.push(...body.orders.map((o) => o.id))
        }
      }

      const productAfter = await prisma.product.findUnique({ where: { id: product.id } })
      expect(productAfter?.stock).toBe(0)
    }, 20_000)

    it('body invalido (items vazio) recebe 400', async () => {
      const address = await createAddressFixture(buyerFixture.user.id)
      createdAddressIds.push(address.id)

      const res = await app.request('/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ items: [], addressId: address.id }),
      })
      expect(res.status).toBe(400)
    }, 20_000)

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
      const body = (await res.json()) as { orders: Array<{ id: string }> }
      createdOrderIds.push(...body.orders.map((o) => o.id))

      const buyerNotification = await prisma.notification.findFirst({
        where: { userId: buyerFixture.user.id, title: 'Pedido confirmado' },
        orderBy: { createdAt: 'desc' },
      })
      expect(buyerNotification).not.toBeNull()
      expect(buyerNotification?.type).toBe('SUCCESS')
      expect(buyerNotification?.href).toBe('/pedidos')

      const ownerNotification = await prisma.notification.findFirst({
        where: { userId: ownerFixture.user.id, title: 'Novo pedido recebido' },
        orderBy: { createdAt: 'desc' },
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

    it('pedido ainda retorna 201 mesmo se a etapa de notificacao pos-commit falhar (findMany de lojas quebra)', async () => {
      // Este e um teste de integracao (sem mocks de Prisma no resto do
      // arquivo), mas simular a falha exata descrita no bug — uma query real
      // de banco (`prisma.store.findMany`) lancando apos a transacao ja ter
      // commitado — exige interceptar essa unica chamada. Usamos
      // `vi.spyOn` apontando para a instancia real do Prisma Client
      // (nao `vi.mock` do modulo inteiro, que quebraria as outras queries
      // reais deste arquivo) e restauramos o comportamento original logo
      // depois, garantindo isolamento do resto da suite.
      //
      // O handler agora tambem chama `prisma.store.findMany` ANTES da
      // transacao (validacao de pickup, selecionando `pickupAvailable`), entao
      // a falha simulada precisa mirar especificamente a chamada pos-commit
      // (que seleciona `ownerId`) para nao quebrar o checkout antes da hora.
      const store = await createStoreFixture()
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id, { priceCents: 5000, stock: 10 })
      createdProductIds.push(product.id)
      const address = await createAddressFixture(buyerFixture.user.id)
      createdAddressIds.push(address.id)

      const originalFindMany = prisma.store.findMany.bind(prisma.store)
      const findManySpy = vi.spyOn(prisma.store, 'findMany').mockImplementation(((args?: { select?: Record<string, unknown> }) => {
        const selectsOwnerId = Boolean(args?.select?.ownerId)
        if (selectsOwnerId) {
          return Promise.reject(new Error('DB indisponivel'))
        }
        return originalFindMany(args as never)
      }) as typeof prisma.store.findMany)

      try {
        const res = await app.request('/orders', {
          method: 'POST',
          headers: { authorization: `Bearer ${buyerToken}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            items: [{ productId: product.id, quantity: 1 }],
            addressId: address.id,
          }),
        })
        expect(res.status).toBe(201)
        const body = (await res.json()) as { orders: Array<{ id: string }> }
        createdOrderIds.push(...body.orders.map((o) => o.id))
        expect(body.orders).toHaveLength(1)

        // O Order foi mesmo persistido no banco, apesar da falha na etapa de
        // notificacao — prova de que o commit anterior nao foi afetado.
        const persisted = await prisma.order.findUnique({ where: { id: body.orders[0]!.id } })
        expect(persisted).not.toBeNull()

        // Garante que o teste realmente exercitou a falha simulada — sem
        // isso, um refactor que mova a busca do dono da loja para fora de
        // `prisma.store.findMany` deixaria este teste verde sem testar nada.
        expect(findManySpy).toHaveBeenCalledWith(
          expect.objectContaining({ select: expect.objectContaining({ ownerId: true }) }),
        )
      } finally {
        findManySpy.mockRestore()
      }

      await prisma.notification.deleteMany({
        where: { userId: { in: [buyerFixture.user.id, ownerFixture.user.id] } },
      })
    }, 20_000)

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
  })

  describe('GET /me/orders', () => {
    it('lista somente os pedidos do proprio usuario, com itens', async () => {
      const store = await createStoreFixture()
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id, { stock: 5 })
      createdProductIds.push(product.id)
      const address = await createAddressFixture(buyerFixture.user.id)
      createdAddressIds.push(address.id)
      const otherAddress = await createAddressFixture(otherBuyerFixture.user.id)
      createdAddressIds.push(otherAddress.id)

      const checkoutRes = await app.request('/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ items: [{ productId: product.id, quantity: 1 }], addressId: address.id }),
      })
      const checkoutBody = (await checkoutRes.json()) as { orders: Array<{ id: string }> }
      createdOrderIds.push(...checkoutBody.orders.map((o) => o.id))

      const otherProduct = await createProductFixture(store.id, { stock: 5 })
      createdProductIds.push(otherProduct.id)
      const otherCheckoutRes = await app.request('/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${otherBuyerToken}` },
        body: JSON.stringify({ items: [{ productId: otherProduct.id, quantity: 1 }], addressId: otherAddress.id }),
      })
      const otherCheckoutBody = (await otherCheckoutRes.json()) as { orders: Array<{ id: string }> }
      createdOrderIds.push(...otherCheckoutBody.orders.map((o) => o.id))

      const res = await app.request('/me/orders', {
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { orders: Array<{ id: string; items: Array<{ productId: string }> }> }
      const ids = body.orders.map((o) => o.id)
      expect(ids).toContain(checkoutBody.orders[0]?.id)
      expect(ids).not.toContain(otherCheckoutBody.orders[0]?.id)
      expect(body.orders.find((o) => o.id === checkoutBody.orders[0]?.id)?.items.length).toBeGreaterThan(0)
    }, 20_000)
  })
})
