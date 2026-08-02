import { afterEach, describe, expect, it } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

/**
 * Testes de integracao contra o Supabase/Postgres reais do projeto, mesmo
 * padrao de `stores.test.ts`. Cada teste usa categoria/titulo com token
 * unico para nao colidir com dados de outras execucoes/testes no mesmo
 * banco compartilhado.
 */
describe('rotas de produto', () => {
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

  const createStoreFixture = async (
    ownerId: string,
    overrides: Partial<{ latitude: number; longitude: number; isActive: boolean }> = {},
  ) =>
    prisma.store.create({
      data: {
        ownerId,
        name: 'Loja Teste 5B',
        slug: unique('teste-fase5b-loja'),
        latitude: overrides.latitude ?? -23.55,
        longitude: overrides.longitude ?? -46.63,
        isActive: overrides.isActive ?? true,
      },
    })

  describe('POST /stores/:storeId/products', () => {
    it('dono da loja cria produto com sucesso (201, storeId da URL, corpo storeId ignorado)', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)
      const store = await createStoreFixture(fixture.user.id)
      createdStoreIds.push(store.id)
      const category = unique('categoria')

      const res = await app.request(`/stores/${store.id}/products`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: 'Produto Teste',
          category,
          priceCents: 1000,
          stock: 5,
          storeId: '00000000-0000-0000-0000-000000000000',
        }),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { product: { id: string; storeId: string; category: string } }
      expect(body.product.storeId).toBe(store.id)
      createdProductIds.push(body.product.id)
    }, 20_000)

    it('nao-dono da loja recebe 403', async () => {
      const owner = await createFixtureUser('STORE_OWNER')
      const other = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(owner.authUserId, other.authUserId)
      const otherToken = await loginToken(other.email, other.password)
      const store = await createStoreFixture(owner.user.id)
      createdStoreIds.push(store.id)

      const res = await app.request(`/stores/${store.id}/products`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${otherToken}` },
        body: JSON.stringify({ title: 'Produto Invasor', category: unique('cat'), priceCents: 500 }),
      })
      expect(res.status).toBe(403)
    }, 20_000)
  })

  describe('GET /products', () => {
    it('filtra por categoria exata', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const store = await createStoreFixture(fixture.user.id)
      createdStoreIds.push(store.id)
      const category = unique('categoria-filtro')

      const product = await prisma.product.create({
        data: { storeId: store.id, title: 'Produto Categoria', category, priceCents: 100 },
      })
      createdProductIds.push(product.id)

      const res = await app.request(`/products?category=${category}`)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { products: Array<{ id: string }> }
      expect(body.products).toHaveLength(1)
      expect(body.products[0]?.id).toBe(product.id)
    }, 20_000)

    it('busca fuzzy por texto, insensivel a acento', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const store = await createStoreFixture(fixture.user.id)
      createdStoreIds.push(store.id)
      const token = unique('paodequeijomineiroxyz')

      const product = await prisma.product.create({
        data: { storeId: store.id, title: `Pão de Queijo ${token}`, category: unique('cat'), priceCents: 100 },
      })
      createdProductIds.push(product.id)

      const res = await app.request(`/products?q=${encodeURIComponent(`pao de queijo ${token}`)}`)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { products: Array<{ id: string }> }
      expect(body.products.some((p) => p.id === product.id)).toBe(true)
    }, 20_000)

    it('busca por raio: produto dentro aparece, fora nao aparece', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const category = unique('categoria-raio')

      // Coordenadas isoladas no meio do oceano para evitar colisao com
      // outras lojas/produtos ja existentes no banco compartilhado.
      const insideStore = await createStoreFixture(fixture.user.id, { latitude: 0.0, longitude: -30.0 })
      const outsideStore = await createStoreFixture(fixture.user.id, { latitude: 10.0, longitude: -30.0 })
      createdStoreIds.push(insideStore.id, outsideStore.id)

      const insideProduct = await prisma.product.create({
        data: { storeId: insideStore.id, title: 'Produto Dentro', category, priceCents: 100 },
      })
      const outsideProduct = await prisma.product.create({
        data: { storeId: outsideStore.id, title: 'Produto Fora', category, priceCents: 100 },
      })
      createdProductIds.push(insideProduct.id, outsideProduct.id)

      const res = await app.request(`/products?category=${category}&lat=0.0&lng=-30.0&radiusKm=50`)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { products: Array<{ id: string }> }
      const ids = body.products.map((p) => p.id)
      expect(ids).toContain(insideProduct.id)
      expect(ids).not.toContain(outsideProduct.id)
    }, 20_000)

    it('lat/lng/radiusKm parciais retornam 400', async () => {
      const res = await app.request('/products?lat=0.0&lng=-30.0')
      expect(res.status).toBe(400)
    })

    it('paginacao respeita limit e offset', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const store = await createStoreFixture(fixture.user.id)
      createdStoreIds.push(store.id)
      const category = unique('categoria-paginacao')

      const products = await Promise.all(
        [0, 1, 2].map((i) =>
          prisma.product.create({
            data: { storeId: store.id, title: `Produto Paginacao ${i}`, category, priceCents: 100 },
          }),
        ),
      )
      createdProductIds.push(...products.map((p) => p.id))

      const firstPage = await app.request(`/products?category=${category}&limit=2&offset=0`)
      const firstBody = (await firstPage.json()) as { products: Array<{ id: string }> }
      expect(firstBody.products).toHaveLength(2)

      const secondPage = await app.request(`/products?category=${category}&limit=2&offset=2`)
      const secondBody = (await secondPage.json()) as { products: Array<{ id: string }> }
      expect(secondBody.products).toHaveLength(1)
    }, 20_000)

    it('nao retorna produto de loja inativa nem produto inativo', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const activeStore = await createStoreFixture(fixture.user.id)
      const inactiveStore = await createStoreFixture(fixture.user.id, { isActive: false })
      createdStoreIds.push(activeStore.id, inactiveStore.id)
      const category = unique('categoria-inativo')

      const inactiveProduct = await prisma.product.create({
        data: { storeId: activeStore.id, title: 'Produto Inativo', category, priceCents: 100, isActive: false },
      })
      const productFromInactiveStore = await prisma.product.create({
        data: { storeId: inactiveStore.id, title: 'Produto Loja Inativa', category, priceCents: 100 },
      })
      createdProductIds.push(inactiveProduct.id, productFromInactiveStore.id)

      const res = await app.request(`/products?category=${category}`)
      const body = (await res.json()) as { products: Array<{ id: string }> }
      const ids = body.products.map((p) => p.id)
      expect(ids).not.toContain(inactiveProduct.id)
      expect(ids).not.toContain(productFromInactiveStore.id)
    }, 20_000)
  })

  describe('GET /products/:id', () => {
    it('404 para produto inexistente, inativo, ou de loja inativa', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const store = await createStoreFixture(fixture.user.id)
      createdStoreIds.push(store.id)

      const inactiveProduct = await prisma.product.create({
        data: { storeId: store.id, title: 'Inativo', category: unique('cat'), priceCents: 100, isActive: false },
      })
      createdProductIds.push(inactiveProduct.id)

      const notFound = await app.request('/products/00000000-0000-0000-0000-000000000000')
      expect(notFound.status).toBe(404)

      const inactiveRes = await app.request(`/products/${inactiveProduct.id}`)
      expect(inactiveRes.status).toBe(404)
    }, 20_000)

    it('200 para produto ativo de loja ativa', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const store = await createStoreFixture(fixture.user.id)
      createdStoreIds.push(store.id)

      const product = await prisma.product.create({
        data: { storeId: store.id, title: 'Ativo', category: unique('cat'), priceCents: 100 },
      })
      createdProductIds.push(product.id)

      const res = await app.request(`/products/${product.id}`)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { product: { id: string } }
      expect(body.product.id).toBe(product.id)
    }, 20_000)
  })

  describe('PATCH /products/:id', () => {
    it('dono atualiza produto com sucesso', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)
      const store = await createStoreFixture(fixture.user.id)
      createdStoreIds.push(store.id)

      const product = await prisma.product.create({
        data: { storeId: store.id, title: 'Original', category: unique('cat'), priceCents: 100 },
      })
      createdProductIds.push(product.id)

      const res = await app.request(`/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: 'Atualizado' }),
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { product: { title: string } }
      expect(body.product.title).toBe('Atualizado')
    }, 20_000)

    it('nao-dono recebe 403', async () => {
      const owner = await createFixtureUser('STORE_OWNER')
      const other = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(owner.authUserId, other.authUserId)
      const otherToken = await loginToken(other.email, other.password)
      const store = await createStoreFixture(owner.user.id)
      createdStoreIds.push(store.id)

      const product = await prisma.product.create({
        data: { storeId: store.id, title: 'Original', category: unique('cat'), priceCents: 100 },
      })
      createdProductIds.push(product.id)

      const res = await app.request(`/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${otherToken}` },
        body: JSON.stringify({ title: 'Invasao' }),
      })
      expect(res.status).toBe(403)
    }, 20_000)
  })

  describe('DELETE /products/:id', () => {
    it('soft-delete: some de GET /products e GET /products/:id, mas continua no banco', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)
      const store = await createStoreFixture(fixture.user.id)
      createdStoreIds.push(store.id)
      const category = unique('categoria-delete')

      const product = await prisma.product.create({
        data: { storeId: store.id, title: 'Para Remover', category, priceCents: 100 },
      })
      createdProductIds.push(product.id)

      const res = await app.request(`/products/${product.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)

      const getRes = await app.request(`/products/${product.id}`)
      expect(getRes.status).toBe(404)

      const listRes = await app.request(`/products?category=${category}`)
      const listBody = (await listRes.json()) as { products: Array<{ id: string }> }
      expect(listBody.products.map((p) => p.id)).not.toContain(product.id)

      const dbProduct = await prisma.product.findUnique({ where: { id: product.id } })
      expect(dbProduct).not.toBeNull()
      expect(dbProduct?.isActive).toBe(false)
    }, 20_000)
  })
})
