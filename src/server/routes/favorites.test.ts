import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

/**
 * Testes de integracao contra o Supabase/Postgres reais, mesmo padrao de
 * `productPhotos.test.ts` — usuarios fixture criados UMA VEZ em `beforeAll`
 * e reaproveitados entre os casos deste arquivo, para nao estourar o
 * rate-limit da API admin do Supabase Auth quando a suite roda 2x seguidas.
 */
describe('rotas de favoritos', () => {
  const createdStoreIds: string[] = []
  const createdProductIds: string[] = []

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
    await prisma.favorite.deleteMany({ where: { productId: { in: createdProductIds } } })
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
        slug: unique('teste-fase6-loja'),
        latitude: -23.55,
        longitude: -46.63,
        isActive: true,
      },
    })

  const createProductFixture = async (storeId: string, overrides: Partial<{ isActive: boolean }> = {}) =>
    prisma.product.create({
      data: {
        storeId,
        title: 'Produto Teste Fase 6',
        category: unique('categoria'),
        priceCents: 1000,
        isActive: overrides.isActive ?? true,
      },
    })

  describe('POST /favorites/:productId', () => {
    it('favorita produto com sucesso (200)', async () => {
      const store = await createStoreFixture()
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      const res = await app.request(`/favorites/${product.id}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(res.status).toBe(200)

      const fav = await prisma.favorite.findUnique({
        where: { userId_productId: { userId: buyerFixture.user.id, productId: product.id } },
      })
      expect(fav).not.toBeNull()
    }, 20_000)

    it('favoritar duas vezes e idempotente (200, sem erro, um unico registro)', async () => {
      const store = await createStoreFixture()
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      const first = await app.request(`/favorites/${product.id}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      const second = await app.request(`/favorites/${product.id}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(first.status).toBe(200)
      expect(second.status).toBe(200)

      const count = await prisma.favorite.count({
        where: { userId: buyerFixture.user.id, productId: product.id },
      })
      expect(count).toBe(1)
    }, 20_000)

    it('404 para produto inexistente ou inativo', async () => {
      const store = await createStoreFixture()
      createdStoreIds.push(store.id)
      const inactiveProduct = await createProductFixture(store.id, { isActive: false })
      createdProductIds.push(inactiveProduct.id)

      const notFound = await app.request('/favorites/00000000-0000-0000-0000-000000000000', {
        method: 'POST',
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(notFound.status).toBe(404)

      const inactiveRes = await app.request(`/favorites/${inactiveProduct.id}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(inactiveRes.status).toBe(404)
    }, 20_000)
  })

  describe('DELETE /favorites/:productId', () => {
    it('remove favorito existente (200)', async () => {
      const store = await createStoreFixture()
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      await prisma.favorite.create({ data: { userId: buyerFixture.user.id, productId: product.id } })

      const res = await app.request(`/favorites/${product.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(res.status).toBe(200)

      const fav = await prisma.favorite.findUnique({
        where: { userId_productId: { userId: buyerFixture.user.id, productId: product.id } },
      })
      expect(fav).toBeNull()
    }, 20_000)

    it('remover favorito inexistente e idempotente (200, sem erro)', async () => {
      const store = await createStoreFixture()
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      const res = await app.request(`/favorites/${product.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(res.status).toBe(200)
    }, 20_000)
  })

  describe('GET /me/favorites', () => {
    it('lista somente os favoritos do proprio usuario', async () => {
      const store = await createStoreFixture()
      createdStoreIds.push(store.id)
      const ownProduct = await createProductFixture(store.id)
      const otherProduct = await createProductFixture(store.id)
      createdProductIds.push(ownProduct.id, otherProduct.id)

      await prisma.favorite.create({ data: { userId: buyerFixture.user.id, productId: ownProduct.id } })
      await prisma.favorite.create({ data: { userId: otherBuyerFixture.user.id, productId: otherProduct.id } })

      const res = await app.request('/me/favorites', {
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { products: Array<{ id: string }> }
      const ids = body.products.map((p) => p.id)
      expect(ids).toContain(ownProduct.id)
      expect(ids).not.toContain(otherProduct.id)

      const otherRes = await app.request('/me/favorites', {
        headers: { authorization: `Bearer ${otherBuyerToken}` },
      })
      const otherBody = (await otherRes.json()) as { products: Array<{ id: string }> }
      const otherIds = otherBody.products.map((p) => p.id)
      expect(otherIds).toContain(otherProduct.id)
      expect(otherIds).not.toContain(ownProduct.id)
    }, 20_000)
  })
})
