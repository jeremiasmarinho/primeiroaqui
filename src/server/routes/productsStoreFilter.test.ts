import { afterEach, describe, expect, it } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

/**
 * GET /products?storeId= — extensao da listagem publica com filtro por loja.
 * Integracao contra o banco real, mesmo padrao de `products.test.ts`.
 */
describe('GET /products com filtro storeId', () => {
  const createdAuthUserIds: string[] = []
  const createdStoreIds: string[] = []
  const createdProductIds: string[] = []

  afterEach(async () => {
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } })
    createdProductIds.length = 0
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

  const setupStoreWithProducts = async () => {
    const owner = await createFixtureUser('STORE_OWNER')
    createdAuthUserIds.push(owner.authUserId)
    const store = await prisma.store.create({
      data: { ownerId: owner.user.id, name: 'Loja Filtro', slug: unique('teste-filtro-loja'), latitude: 0, longitude: 0 },
    })
    createdStoreIds.push(store.id)
    const active = await prisma.product.create({
      data: { storeId: store.id, title: unique('Ativo'), category: unique('cat'), priceCents: 1000, stock: 1 },
    })
    const inactive = await prisma.product.create({
      data: { storeId: store.id, title: unique('Inativo'), category: unique('cat'), priceCents: 1000, stock: 1, isActive: false },
    })
    createdProductIds.push(active.id, inactive.id)
    return { owner, store, active, inactive }
  }

  it('anonimo ve apenas produtos ativos da loja informada', async () => {
    const { store, active, inactive } = await setupStoreWithProducts()

    const res = await app.request(`/products?storeId=${store.id}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { products: Array<{ id: string; storeId: string }> }
    const ids = body.products.map((p) => p.id)
    expect(ids).toContain(active.id)
    expect(ids).not.toContain(inactive.id)
    expect(body.products.every((p) => p.storeId === store.id)).toBe(true)
  }, 30_000)

  it('dono autenticado ve tambem os produtos inativos da propria loja', async () => {
    const { owner, store, active, inactive } = await setupStoreWithProducts()
    const token = await loginToken(owner.email, owner.password)

    const res = await app.request(`/products?storeId=${store.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { products: Array<{ id: string }> }
    const ids = body.products.map((p) => p.id)
    expect(ids).toContain(active.id)
    expect(ids).toContain(inactive.id)
  }, 30_000)

  it('outro STORE_OWNER autenticado NAO ve inativos de loja alheia', async () => {
    const { store, inactive } = await setupStoreWithProducts()
    const other = await createFixtureUser('STORE_OWNER')
    createdAuthUserIds.push(other.authUserId)
    const token = await loginToken(other.email, other.password)

    const res = await app.request(`/products?storeId=${store.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { products: Array<{ id: string }> }
    expect(body.products.map((p) => p.id)).not.toContain(inactive.id)
  }, 30_000)

  it('dono reativa produto inativo via PATCH isActive (200)', async () => {
    const { owner, inactive } = await setupStoreWithProducts()
    const token = await loginToken(owner.email, owner.password)

    const res = await app.request(`/products/${inactive.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ isActive: true }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { product: { isActive: boolean } }
    expect(body.product.isActive).toBe(true)

    const dbProduct = await prisma.product.findUnique({ where: { id: inactive.id } })
    expect(dbProduct?.isActive).toBe(true)
  }, 30_000)

  it('storeId inexistente retorna lista vazia; storeId invalido retorna 400', async () => {
    const missing = await app.request('/products?storeId=00000000-0000-0000-0000-000000000000')
    expect(missing.status).toBe(200)
    const body = (await missing.json()) as { products: unknown[] }
    expect(body.products).toEqual([])

    const invalid = await app.request('/products?storeId=nao-e-uuid')
    expect(invalid.status).toBe(400)
  }, 30_000)
})
