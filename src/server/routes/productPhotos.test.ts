import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { supabaseAdmin } from '../lib/supabaseClient'
import { PRODUCT_PHOTOS_BUCKET, buildThumbStoragePath } from '../lib/productPhotoStorage'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

/**
 * Testes de integracao contra o Supabase (Storage + Auth) e Postgres reais
 * do projeto, mesmo padrao de `products.test.ts`. Uploads reais vao para o
 * bucket `product-photos` do Supabase Storage real — todo path de teste e
 * limpo no `afterEach` (registro Prisma + arquivos no Storage).
 *
 * Usuarios fixture (Supabase Auth) sao criados UMA VEZ em `beforeAll` e
 * reaproveitados entre todos os casos deste arquivo (em vez de um usuario
 * novo por `it()`), para nao estourar o rate-limit da API admin do Supabase
 * Auth quando a suite completa roda duas vezes seguidas.
 */
describe('rotas de fotos de produto', () => {
  const createdStoreIds: string[] = []
  const createdProductIds: string[] = []
  const createdStoragePaths: string[] = []

  let ownerFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let otherFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let ownerToken: string
  let otherToken: string

  beforeAll(async () => {
    ownerFixture = await createFixtureUser('STORE_OWNER')
    otherFixture = await createFixtureUser('STORE_OWNER')
    ownerToken = await loginToken(ownerFixture.email, ownerFixture.password)
    otherToken = await loginToken(otherFixture.email, otherFixture.password)
  }, 30_000)

  afterAll(async () => {
    await Promise.all([deleteFixtureUser(ownerFixture.authUserId), deleteFixtureUser(otherFixture.authUserId)])
  })

  afterEach(async () => {
    if (createdStoragePaths.length > 0) {
      await supabaseAdmin.storage.from(PRODUCT_PHOTOS_BUCKET).remove(createdStoragePaths)
      createdStoragePaths.length = 0
    }
    await prisma.productPhoto.deleteMany({ where: { productId: { in: createdProductIds } } })
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

  const createStoreFixture = async (ownerId: string) =>
    prisma.store.create({
      data: {
        ownerId,
        name: 'Loja Teste 5C',
        slug: unique('teste-fase5c-loja'),
        latitude: -23.55,
        longitude: -46.63,
        isActive: true,
      },
    })

  const createProductFixture = async (storeId: string) =>
    prisma.product.create({
      data: { storeId, title: 'Produto Teste 5C', category: unique('categoria'), priceCents: 1000 },
    })

  const tinyJpeg = async (): Promise<Buffer> =>
    sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 200, g: 50, b: 50 } } })
      .jpeg()
      .toBuffer()

  const buildFormData = (file: Buffer, filename: string, type: string) => {
    const formData = new FormData()
    formData.append('photo', new File([new Uint8Array(file)], filename, { type }))
    return formData
  }

  describe('POST /products/:id/photos', () => {
    it('dono envia foto valida (201, registro criado, URLs presentes)', async () => {
      const store = await createStoreFixture(ownerFixture.user.id)
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      const jpeg = await tinyJpeg()
      const res = await app.request(`/products/${product.id}/photos`, {
        method: 'POST',
        headers: { authorization: `Bearer ${ownerToken}` },
        body: buildFormData(jpeg, 'foto.jpg', 'image/jpeg'),
      })

      expect(res.status).toBe(201)
      const body = (await res.json()) as {
        photo: { id: string; productId: string; url: string; thumbUrl: string; path: string; position: number }
      }
      createdStoragePaths.push(body.photo.path, buildThumbStoragePath(body.photo.path))
      expect(body.photo.productId).toBe(product.id)
      expect(body.photo.url).toMatch(/^https?:\/\//)
      expect(body.photo.thumbUrl).toMatch(/^https?:\/\//)
      expect(body.photo.position).toBe(0)
    }, 30_000)

    it('tipo de arquivo invalido recebe 400, sem registro criado', async () => {
      const store = await createStoreFixture(ownerFixture.user.id)
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      const res = await app.request(`/products/${product.id}/photos`, {
        method: 'POST',
        headers: { authorization: `Bearer ${ownerToken}` },
        body: buildFormData(Buffer.from('nao e uma imagem'), 'arquivo.txt', 'text/plain'),
      })

      expect(res.status).toBe(400)
      const count = await prisma.productPhoto.count({ where: { productId: product.id } })
      expect(count).toBe(0)
    }, 30_000)

    it('MIME declarado como imagem mas conteudo invalido recebe 400, sem registro e sem upload no storage', async () => {
      const store = await createStoreFixture(ownerFixture.user.id)
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      const fakeJpeg = Buffer.from('isto nao e uma imagem de verdade, so texto disfarcado de jpeg')
      const res = await app.request(`/products/${product.id}/photos`, {
        method: 'POST',
        headers: { authorization: `Bearer ${ownerToken}` },
        body: buildFormData(fakeJpeg, 'foto-falsa.jpg', 'image/jpeg'),
      })

      expect(res.status).toBe(400)
      const count = await prisma.productPhoto.count({ where: { productId: product.id } })
      expect(count).toBe(0)

      const { data: listing } = await supabaseAdmin.storage.from(PRODUCT_PHOTOS_BUCKET).list(product.id)
      expect(listing ?? []).toHaveLength(0)
    }, 30_000)

    it('arquivo maior que 5MB recebe 400', async () => {
      const store = await createStoreFixture(ownerFixture.user.id)
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 1)
      const res = await app.request(`/products/${product.id}/photos`, {
        method: 'POST',
        headers: { authorization: `Bearer ${ownerToken}` },
        body: buildFormData(bigBuffer, 'grande.jpg', 'image/jpeg'),
      })

      expect(res.status).toBe(400)
      const count = await prisma.productPhoto.count({ where: { productId: product.id } })
      expect(count).toBe(0)
    }, 30_000)

    it('nao-dono do produto recebe 403', async () => {
      const store = await createStoreFixture(ownerFixture.user.id)
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      const jpeg = await tinyJpeg()
      const res = await app.request(`/products/${product.id}/photos`, {
        method: 'POST',
        headers: { authorization: `Bearer ${otherToken}` },
        body: buildFormData(jpeg, 'foto.jpg', 'image/jpeg'),
      })

      expect(res.status).toBe(403)
    }, 30_000)
  })

  describe('DELETE /products/:id/photos/:photoId', () => {
    it('dono remove foto com sucesso (registro e arquivos removidos)', async () => {
      const store = await createStoreFixture(ownerFixture.user.id)
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      const jpeg = await tinyJpeg()
      const uploadRes = await app.request(`/products/${product.id}/photos`, {
        method: 'POST',
        headers: { authorization: `Bearer ${ownerToken}` },
        body: buildFormData(jpeg, 'foto.jpg', 'image/jpeg'),
      })
      const uploadBody = (await uploadRes.json()) as { photo: { id: string; path: string } }
      const thumbPath = buildThumbStoragePath(uploadBody.photo.path)
      // Registrado para limpeza ANTES do DELETE: se o DELETE falhar ou um
      // assert abaixo falhar, o afterEach ainda tenta remover os arquivos
      // (Storage nao erra ao remover um path que ja nao existe).
      createdStoragePaths.push(uploadBody.photo.path, thumbPath)

      const deleteRes = await app.request(`/products/${product.id}/photos/${uploadBody.photo.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${ownerToken}` },
      })
      expect(deleteRes.status).toBe(200)

      const dbPhoto = await prisma.productPhoto.findUnique({ where: { id: uploadBody.photo.id } })
      expect(dbPhoto).toBeNull()

      const folder = uploadBody.photo.path.split('/')[0]
      const { data: listing } = await supabaseAdmin.storage.from(PRODUCT_PHOTOS_BUCKET).list(folder)
      const remainingNames = (listing ?? []).map((entry) => entry.name)
      expect(remainingNames).not.toContain(uploadBody.photo.path.split('/')[1])
      expect(remainingNames).not.toContain(thumbPath.split('/')[1])
    }, 30_000)

    it('nao-dono recebe 403', async () => {
      const store = await createStoreFixture(ownerFixture.user.id)
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      const jpeg = await tinyJpeg()
      const uploadRes = await app.request(`/products/${product.id}/photos`, {
        method: 'POST',
        headers: { authorization: `Bearer ${ownerToken}` },
        body: buildFormData(jpeg, 'foto.jpg', 'image/jpeg'),
      })
      const uploadBody = (await uploadRes.json()) as { photo: { id: string; path: string } }
      createdStoragePaths.push(uploadBody.photo.path, buildThumbStoragePath(uploadBody.photo.path))

      const res = await app.request(`/products/${product.id}/photos/${uploadBody.photo.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${otherToken}` },
      })
      expect(res.status).toBe(403)
    }, 30_000)

    it('foto inexistente recebe 404', async () => {
      const store = await createStoreFixture(ownerFixture.user.id)
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      const res = await app.request(`/products/${product.id}/photos/00000000-0000-0000-0000-000000000000`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${ownerToken}` },
      })
      expect(res.status).toBe(404)
    }, 30_000)
  })
})
