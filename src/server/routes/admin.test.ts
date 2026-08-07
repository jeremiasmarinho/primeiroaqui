import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

/**
 * Rotas do painel admin da plataforma — integracao contra o Supabase/Postgres
 * reais, padrao de fixtures compartilhadas de orders.test.ts. As metricas
 * agregam o banco INTEIRO (outros dados podem existir), entao os asserts sao
 * relativos (>=, contem) e nunca de igualdade absoluta.
 *
 * "Admin pode atualizar status de qualquer pedido" ja e coberto por
 * ordersStatus.test.ts ("ADMIN (nao dono) pode atualizar"); aqui cobrimos as
 * rotas /admin/* novas.
 */
describe('rotas /admin', () => {
  const createdStoreIds: string[] = []
  const createdProductIds: string[] = []
  const createdAddressIds: string[] = []
  const createdOrderIds: string[] = []

  let adminFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let buyerFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let ownerFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let adminToken: string
  let buyerToken: string

  const loginToken = async (email: string, password: string) => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = (await res.json()) as { session: { accessToken: string } }
    return body.session.accessToken
  }

  beforeAll(async () => {
    adminFixture = await createFixtureUser('ADMIN')
    buyerFixture = await createFixtureUser('BUYER')
    ownerFixture = await createFixtureUser('STORE_OWNER')
    adminToken = await loginToken(adminFixture.email, adminFixture.password)
    buyerToken = await loginToken(buyerFixture.email, buyerFixture.password)
  }, 30_000)

  afterAll(async () => {
    await Promise.all([
      deleteFixtureUser(adminFixture.authUserId),
      deleteFixtureUser(buyerFixture.authUserId),
      deleteFixtureUser(ownerFixture.authUserId),
    ])
  })

  afterEach(async () => {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } })
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } })
    createdOrderIds.length = 0
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } })
    createdProductIds.length = 0
    await prisma.address.deleteMany({ where: { id: { in: createdAddressIds } } })
    createdAddressIds.length = 0
    await prisma.store.deleteMany({ where: { id: { in: createdStoreIds } } })
    createdStoreIds.length = 0
  })

  const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const createStoreFixture = async (overrides: Partial<{ isActive: boolean }> = {}) => {
    const store = await prisma.store.create({
      data: {
        ownerId: ownerFixture.user.id,
        name: 'Loja Admin Teste',
        slug: unique('teste-admin-loja'),
        latitude: 0,
        longitude: 0,
        isActive: overrides.isActive ?? true,
      },
    })
    createdStoreIds.push(store.id)
    return store
  }

  const createOrderFixture = async (
    storeId: string,
    overrides: Partial<{ totalCents: number; status: 'PENDING' | 'CANCELED' | 'DELIVERED' }> = {},
  ) => {
    const address = await prisma.address.create({
      data: {
        userId: buyerFixture.user.id,
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
    const order = await prisma.order.create({
      data: {
        buyerId: buyerFixture.user.id,
        storeId,
        addressId: address.id,
        totalCents: overrides.totalCents ?? 1000,
        status: overrides.status ?? 'PENDING',
      },
    })
    createdOrderIds.push(order.id)
    return order
  }

  describe('controle de acesso (403 para nao-admin)', () => {
    it.each([
      ['GET', '/admin/metrics'],
      ['GET', '/admin/orders'],
      ['GET', '/admin/stores'],
      ['PATCH', '/admin/stores/00000000-0000-0000-0000-000000000000'],
    ])('%s %s exige ADMIN', async (method, path) => {
      const res = await app.request(path, {
        method,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: method === 'PATCH' ? JSON.stringify({ isActive: false }) : undefined,
      })
      expect(res.status).toBe(403)

      const anon = await app.request(path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'PATCH' ? JSON.stringify({ isActive: false }) : undefined,
      })
      expect(anon.status).toBe(401)
    }, 20_000)
  })

  describe('GET /admin/metrics', () => {
    it('agrega totais, distribuicao por status e serie de 30 dias; GMV exclui cancelados', async () => {
      const store = await createStoreFixture()
      await createOrderFixture(store.id, { totalCents: 5000, status: 'DELIVERED' })
      await createOrderFixture(store.id, { totalCents: 7000, status: 'CANCELED' })

      const before = await app.request('/admin/metrics', {
        headers: { authorization: `Bearer ${adminToken}` },
      })
      expect(before.status).toBe(200)
      const body = (await before.json()) as {
        totals: {
          users: number
          stores: number
          activeStores: number
          products: number
          orders: number
          gmvCents: number
        }
        ordersByStatus: Record<string, number>
        last30Days: Array<{ date: string; orders: number; gmvCents: number }>
      }

      expect(body.totals.users).toBeGreaterThanOrEqual(3)
      expect(body.totals.stores).toBeGreaterThanOrEqual(1)
      expect(body.totals.activeStores).toBeGreaterThanOrEqual(1)
      expect(body.totals.orders).toBeGreaterThanOrEqual(2)
      expect(body.ordersByStatus['DELIVERED']).toBeGreaterThanOrEqual(1)
      expect(body.ordersByStatus['CANCELED']).toBeGreaterThanOrEqual(1)

      // GMV do banco inteiro sem os nossos pedidos e desconhecido, mas o
      // delta e verificavel: cancelado nao soma.
      const gmvDb = await prisma.order.aggregate({
        _sum: { totalCents: true },
        where: { status: { not: 'CANCELED' } },
      })
      expect(body.totals.gmvCents).toBe(gmvDb._sum.totalCents ?? 0)

      expect(body.last30Days).toHaveLength(30)
      const today = body.last30Days[29]
      expect(today?.date).toBe(new Date().toISOString().slice(0, 10))
      expect(today?.orders).toBeGreaterThanOrEqual(2)
      // 5000 do DELIVERED entra; 7000 do CANCELED fica de fora do GMV do dia.
      expect(today?.gmvCents).toBeGreaterThanOrEqual(5000)
    }, 30_000)
  })

  describe('GET /admin/orders', () => {
    it('lista com nome do comprador, nome da loja e itens, mais novos primeiro, com paginacao', async () => {
      const store = await createStoreFixture()
      const older = await createOrderFixture(store.id, { totalCents: 1000 })
      const newer = await createOrderFixture(store.id, { totalCents: 2000 })

      const res = await app.request('/admin/orders?limit=200', {
        headers: { authorization: `Bearer ${adminToken}` },
      })
      // limit acima do teto e clampado (100) — nada de 500.
      expect(res.status).toBe(200)

      const full = await app.request('/admin/orders?limit=100&offset=0', {
        headers: { authorization: `Bearer ${adminToken}` },
      })
      const body = (await full.json()) as {
        orders: Array<{
          id: string
          buyerName: string
          storeName: string
          items: unknown[]
          createdAt: string
        }>
        total: number
      }
      expect(body.total).toBeGreaterThanOrEqual(2)
      const ids = body.orders.map((o) => o.id)
      const newerIdx = ids.indexOf(newer.id)
      const olderIdx = ids.indexOf(older.id)
      expect(newerIdx).toBeGreaterThanOrEqual(0)
      expect(newerIdx).toBeLessThan(olderIdx)
      const row = body.orders.find((o) => o.id === newer.id)
      expect(row?.buyerName).toBe(buyerFixture.user.name)
      expect(row?.storeName).toBe('Loja Admin Teste')
      expect(Array.isArray(row?.items)).toBe(true)

      // Paginacao: limit=1 devolve exatamente 1; offset pula o primeiro.
      const page = await app.request('/admin/orders?limit=1&offset=0', {
        headers: { authorization: `Bearer ${adminToken}` },
      })
      const pageBody = (await page.json()) as { orders: Array<{ id: string }> }
      expect(pageBody.orders).toHaveLength(1)
      const page2 = await app.request('/admin/orders?limit=1&offset=1', {
        headers: { authorization: `Bearer ${adminToken}` },
      })
      const page2Body = (await page2.json()) as { orders: Array<{ id: string }> }
      expect(page2Body.orders).toHaveLength(1)
      expect(page2Body.orders[0]?.id).not.toBe(pageBody.orders[0]?.id)
    }, 30_000)
  })

  describe('GET /admin/stores', () => {
    it('lista lojas com dono, contagens e isActive', async () => {
      const store = await createStoreFixture({ isActive: false })
      await prisma.product.create({
        data: { storeId: store.id, title: 'Produto Admin', category: unique('cat'), priceCents: 500, stock: 1 },
      }).then((p) => createdProductIds.push(p.id))
      await createOrderFixture(store.id)

      const res = await app.request('/admin/stores', {
        headers: { authorization: `Bearer ${adminToken}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        stores: Array<{
          id: string
          name: string
          ownerName: string
          productCount: number
          orderCount: number
          isActive: boolean
          category: string
        }>
      }
      const row = body.stores.find((s) => s.id === store.id)
      expect(row).toBeDefined()
      expect(row?.category).toBe('OUTROS')
      expect(row?.ownerName).toBe(ownerFixture.user.name)
      expect(row?.productCount).toBe(1)
      expect(row?.orderCount).toBe(1)
      expect(row?.isActive).toBe(false)
    }, 30_000)
  })

  describe('PATCH /admin/stores/:id', () => {
    it('desativa e reativa a loja; body invalido 400; loja inexistente 404', async () => {
      const store = await createStoreFixture({ isActive: true })

      const off = await app.request(`/admin/stores/${store.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ isActive: false }),
      })
      expect(off.status).toBe(200)
      const offBody = (await off.json()) as { store: { isActive: boolean } }
      expect(offBody.store.isActive).toBe(false)
      expect((await prisma.store.findUnique({ where: { id: store.id } }))?.isActive).toBe(false)

      const on = await app.request(`/admin/stores/${store.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ isActive: true }),
      })
      expect(on.status).toBe(200)
      expect((await prisma.store.findUnique({ where: { id: store.id } }))?.isActive).toBe(true)

      const invalid = await app.request(`/admin/stores/${store.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ isActive: 'sim' }),
      })
      expect(invalid.status).toBe(400)

      const missing = await app.request('/admin/stores/00000000-0000-0000-0000-000000000000', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ isActive: true }),
      })
      expect(missing.status).toBe(404)
    }, 30_000)
  })
})
