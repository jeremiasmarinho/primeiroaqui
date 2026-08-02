import { afterEach, describe, expect, it } from 'vitest'
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
 */
describe('rotas de fotos de produto', () => {
  const createdAuthUserIds: string[] = []
  const createdStoreIds: string[] = []
  const createdProductIds: string[] = []
  const createdStoragePaths: string[] = []

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
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)
      const store = await createStoreFixture(fixture.user.id)
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      const jpeg = await tinyJpeg()
      const res = await app.request(`/products/${product.id}/photos`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: buildFormData(jpeg, 'foto.jpg', 'image/jpeg'),
      })

      expect(res.status).toBe(201)
      const body = (await res.json()) as {
        photo: { id: string; productId: string; url: string; thumbUrl: string; path: string; position: number }
      }
      expect(body.photo.productId).toBe(product.id)
      expect(body.photo.url).toMatch(/^https?:\/\//)
      expect(body.photo.thumbUrl).toMatch(/^https?:\/\//)
      expect(body.photo.position).toBe(0)
      createdStoragePaths.push(body.photo.path, buildThumbStoragePath(body.photo.path))
    }, 30_000)

    it('tipo de arquivo invalido recebe 400, sem registro criado', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)
      const store = await createStoreFixture(fixture.user.id)
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      const res = await app.request(`/products/${product.id}/photos`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: buildFormData(Buffer.from('nao e uma imagem'), 'arquivo.txt', 'text/plain'),
      })

      expect(res.status).toBe(400)
      const count = await prisma.productPhoto.count({ where: { productId: product.id } })
      expect(count).toBe(0)
    }, 30_000)

    it('arquivo maior que 5MB recebe 400', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)
      const store = await createStoreFixture(fixture.user.id)
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 1)
      const res = await app.request(`/products/${product.id}/photos`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: buildFormData(bigBuffer, 'grande.jpg', 'image/jpeg'),
      })

      expect(res.status).toBe(400)
      const count = await prisma.productPhoto.count({ where: { productId: product.id } })
      expect(count).toBe(0)
    }, 30_000)

    it('nao-dono do produto recebe 403', async () => {
      const owner = await createFixtureUser('STORE_OWNER')
      const other = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(owner.authUserId, other.authUserId)
      const otherToken = await loginToken(other.email, other.password)
      const store = await createStoreFixture(owner.user.id)
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
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)
      const store = await createStoreFixture(fixture.user.id)
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      const jpeg = await tinyJpeg()
      const uploadRes = await app.request(`/products/${product.id}/photos`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: buildFormData(jpeg, 'foto.jpg', 'image/jpeg'),
      })
      const uploadBody = (await uploadRes.json()) as { photo: { id: string; path: string } }
      const thumbPath = buildThumbStoragePath(uploadBody.photo.path)

      const deleteRes = await app.request(`/products/${product.id}/photos/${uploadBody.photo.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
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
      const owner = await createFixtureUser('STORE_OWNER')
      const other = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(owner.authUserId, other.authUserId)
      const ownerToken = await loginToken(owner.email, owner.password)
      const otherToken = await loginToken(other.email, other.password)
      const store = await createStoreFixture(owner.user.id)
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
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)
      const store = await createStoreFixture(fixture.user.id)
      createdStoreIds.push(store.id)
      const product = await createProductFixture(store.id)
      createdProductIds.push(product.id)

      const res = await app.request(`/products/${product.id}/photos/00000000-0000-0000-0000-000000000000`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(404)
    }, 30_000)
  })
})
