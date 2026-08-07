import { afterEach, describe, expect, it } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

/**
 * Testes de integracao contra o Supabase/Postgres reais do projeto, mesmo
 * padrao de `stores.test.ts` — fixtures via API admin e limpeza no afterEach.
 */
describe('rotas de onboarding e painel do lojista', () => {
  const createdAuthUserIds: string[] = []
  const createdStoreIds: string[] = []
  const createdOrderIds: string[] = []
  const createdProductIds: string[] = []
  const createdAddressIds: string[] = []

  afterEach(async () => {
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } })
    createdOrderIds.length = 0
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } })
    createdProductIds.length = 0
    await prisma.address.deleteMany({ where: { id: { in: createdAddressIds } } })
    createdAddressIds.length = 0
    await prisma.store.deleteMany({ where: { id: { in: createdStoreIds } } })
    createdStoreIds.length = 0
    await Promise.all(createdAuthUserIds.map((id) => deleteFixtureUser(id)))
    createdAuthUserIds.length = 0
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

  const createStoreFixture = async (ownerId: string) => {
    const store = await prisma.store.create({
      data: {
        ownerId,
        name: 'Loja Painel',
        slug: unique('teste-painel-loja'),
        latitude: -23.55,
        longitude: -46.63,
      },
    })
    createdStoreIds.push(store.id)
    return store
  }

  describe('POST /me/become-store-owner', () => {
    it('promove BUYER a STORE_OWNER e persiste no banco', async () => {
      const fixture = await createFixtureUser('BUYER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)

      const res = await app.request('/me/become-store-owner', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { user: { id: string; role: string } }
      expect(body.user.role).toBe('STORE_OWNER')

      const dbUser = await prisma.user.findUnique({ where: { id: fixture.user.id } })
      expect(dbUser?.role).toBe('STORE_OWNER')
    }, 20_000)

    it('e idempotente: quem ja e STORE_OWNER continua STORE_OWNER (200)', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)

      const res = await app.request('/me/become-store-owner', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { user: { role: string } }
      expect(body.user.role).toBe('STORE_OWNER')
    }, 20_000)

    it('ADMIN nao muda de papel', async () => {
      const fixture = await createFixtureUser('ADMIN')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)

      const res = await app.request('/me/become-store-owner', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { user: { role: string } }
      expect(body.user.role).toBe('ADMIN')

      const dbUser = await prisma.user.findUnique({ where: { id: fixture.user.id } })
      expect(dbUser?.role).toBe('ADMIN')
    }, 20_000)

    it('body com role e ignorado — nunca vira ADMIN (anti-escalação)', async () => {
      const fixture = await createFixtureUser('BUYER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)

      const res = await app.request('/me/become-store-owner', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: 'ADMIN' }),
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { user: { role: string } }
      expect(body.user.role).toBe('STORE_OWNER')
    }, 20_000)

    it('sem token retorna 401', async () => {
      const res = await app.request('/me/become-store-owner', { method: 'POST' })
      expect(res.status).toBe(401)
    })
  })

  describe('GET /me/stores', () => {
    it('lista apenas as lojas do usuario logado', async () => {
      const owner = await createFixtureUser('STORE_OWNER')
      const other = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(owner.authUserId, other.authUserId)
      const store = await createStoreFixture(owner.user.id)
      await createStoreFixture(other.user.id)
      const token = await loginToken(owner.email, owner.password)

      const res = await app.request('/me/stores', {
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { stores: Array<{ id: string }> }
      expect(body.stores.map((s) => s.id)).toEqual([store.id])
    }, 30_000)

    it('BUYER recebe 403', async () => {
      const fixture = await createFixtureUser('BUYER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)

      const res = await app.request('/me/stores', {
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(403)
    }, 20_000)
  })

  describe('GET /me/store-orders', () => {
    it('retorna pedidos das lojas do usuario com itens e nome do comprador, mais novos primeiro', async () => {
      const owner = await createFixtureUser('STORE_OWNER')
      const buyer = await createFixtureUser('BUYER')
      createdAuthUserIds.push(owner.authUserId, buyer.authUserId)
      const store = await createStoreFixture(owner.user.id)

      const product = await prisma.product.create({
        data: { storeId: store.id, title: unique('Produto Painel'), category: unique('cat'), priceCents: 1000, stock: 10 },
      })
      createdProductIds.push(product.id)

      const address = await prisma.address.create({
        data: {
          userId: buyer.user.id,
          label: 'Casa',
          street: 'Rua Um, 1',
          city: 'SP',
          state: 'SP',
          zipCode: '01000-000',
          latitude: 0,
          longitude: 0,
        },
      })
      createdAddressIds.push(address.id)

      const older = await prisma.order.create({
        data: {
          buyerId: buyer.user.id,
          storeId: store.id,
          addressId: address.id,
          totalCents: 1000,
          createdAt: new Date(Date.now() - 60_000),
          items: { create: [{ productId: product.id, quantity: 1, unitPriceCents: 1000 }] },
        },
      })
      const newer = await prisma.order.create({
        data: {
          buyerId: buyer.user.id,
          storeId: store.id,
          addressId: address.id,
          totalCents: 2000,
          items: { create: [{ productId: product.id, quantity: 2, unitPriceCents: 1000 }] },
        },
      })
      createdOrderIds.push(older.id, newer.id)

      const token = await loginToken(owner.email, owner.password)
      const res = await app.request('/me/store-orders', {
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        orders: Array<{ id: string; buyerName: string; items: Array<{ quantity: number }> }>
      }
      expect(body.orders.map((o) => o.id)).toEqual([newer.id, older.id])
      expect(body.orders[0]?.buyerName).toBe(buyer.user.name)
      expect(body.orders[0]?.items).toHaveLength(1)
      expect(body.orders[0]?.items[0]?.quantity).toBe(2)
    }, 30_000)

    it('dono de outra loja nao ve pedidos alheios (lista vazia)', async () => {
      const owner = await createFixtureUser('STORE_OWNER')
      const other = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(owner.authUserId, other.authUserId)
      await createStoreFixture(owner.user.id)
      const token = await loginToken(other.email, other.password)

      const res = await app.request('/me/store-orders', {
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { orders: unknown[] }
      expect(body.orders).toEqual([])
    }, 30_000)
  })

  describe('GET /me/store-customers', () => {
    it('agrega compradores de multiplas lojas do usuario, ordenado por ultima compra desc', async () => {
      const owner = await createFixtureUser('STORE_OWNER')
      const buyerA = await createFixtureUser('BUYER')
      const buyerB = await createFixtureUser('BUYER')
      createdAuthUserIds.push(owner.authUserId, buyerA.authUserId, buyerB.authUserId)
      const storeOne = await createStoreFixture(owner.user.id)
      const storeTwo = await createStoreFixture(owner.user.id)

      const product = await prisma.product.create({
        data: { storeId: storeOne.id, title: unique('Produto CRM'), category: unique('cat'), priceCents: 1000, stock: 10 },
      })
      createdProductIds.push(product.id)

      const address = await prisma.address.create({
        data: {
          userId: buyerA.user.id,
          label: 'Casa',
          street: 'Rua Um, 1',
          city: 'SP',
          state: 'SP',
          zipCode: '01000-000',
          latitude: 0,
          longitude: 0,
        },
      })
      createdAddressIds.push(address.id)

      // buyerA: dois pedidos (lojas diferentes), buyerB: um pedido.
      const orderA1 = await prisma.order.create({
        data: {
          buyerId: buyerA.user.id,
          storeId: storeOne.id,
          addressId: address.id,
          totalCents: 1000,
          status: 'DELIVERED',
          createdAt: new Date(Date.now() - 120_000),
          items: { create: [{ productId: product.id, quantity: 1, unitPriceCents: 1000 }] },
        },
      })
      const orderB1 = await prisma.order.create({
        data: {
          buyerId: buyerB.user.id,
          storeId: storeTwo.id,
          addressId: address.id,
          totalCents: 500,
          status: 'PENDING',
          createdAt: new Date(Date.now() - 60_000),
          items: { create: [{ productId: product.id, quantity: 1, unitPriceCents: 500 }] },
        },
      })
      const orderA2 = await prisma.order.create({
        data: {
          buyerId: buyerA.user.id,
          storeId: storeTwo.id,
          addressId: address.id,
          totalCents: 2000,
          status: 'CONFIRMED',
          items: { create: [{ productId: product.id, quantity: 2, unitPriceCents: 1000 }] },
        },
      })
      createdOrderIds.push(orderA1.id, orderB1.id, orderA2.id)

      const token = await loginToken(owner.email, owner.password)
      const res = await app.request('/me/store-customers', {
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        customers: Array<{
          buyerId: string
          name: string
          ordersCount: number
          totalCents: number
          lastOrderStatus: string
        }>
      }
      expect(body.customers.map((c) => c.buyerId)).toEqual([buyerA.user.id, buyerB.user.id])
      const customerA = body.customers[0]!
      expect(customerA.ordersCount).toBe(2)
      expect(customerA.totalCents).toBe(3000)
      expect(customerA.lastOrderStatus).toBe('CONFIRMED')
    }, 30_000)

    it('BUYER (sem loja) recebe 403', async () => {
      const fixture = await createFixtureUser('BUYER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)

      const res = await app.request('/me/store-customers', {
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(403)
    }, 20_000)
  })
})
