import { afterEach, describe, expect, it } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

/**
 * Testes de integracao contra o Supabase/Postgres reais do projeto (sem
 * ambiente de teste separado neste MVP), seguindo o mesmo padrao de
 * `src/server/routes/auth.test.ts` — fixtures via API admin do Supabase
 * (nunca signup publico) e limpeza no `afterEach` para nao acumular lixo no
 * banco real.
 */
describe('rotas de loja', () => {
  const createdAuthUserIds: string[] = []
  const createdStoreIds: string[] = []

  afterEach(async () => {
    await prisma.store.deleteMany({ where: { id: { in: createdStoreIds } } })
    createdStoreIds.length = 0
    // Limpar notificacoes antes de deletar usuarios (FK constraint)
    await Promise.all(
      createdAuthUserIds.map(async (authUserId) => {
        const user = await prisma.user.findUnique({ where: { authUserId } })
        if (user) {
          await prisma.notification.deleteMany({ where: { userId: user.id } })
        }
      }),
    )
    await Promise.all(createdAuthUserIds.map((id) => deleteFixtureUser(id)))
    createdAuthUserIds.length = 0
  })

  const uniqueSlug = (prefix: string) =>
    `teste-fase5a-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const loginToken = async (email: string, password: string) => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = (await res.json()) as { session: { accessToken: string } }
    return body.session.accessToken
  }

  describe('POST /stores', () => {
    it('STORE_OWNER cria loja com sucesso', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)
      const slug = uniqueSlug('sucesso')

      const res = await app.request('/stores', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: 'Loja Teste',
          slug,
          description: 'Uma loja de teste',
          latitude: -23.55,
          longitude: -46.63,
        }),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { store: { id: string; slug: string; ownerId?: string; category: string } }
      expect(body.store.slug).toBe(slug)
      expect(body.store.category).toBe('OUTROS')
      createdStoreIds.push(body.store.id)

      const dbStore = await prisma.store.findUnique({ where: { id: body.store.id } })
      expect(dbStore?.ownerId).toBe(fixture.user.id)
    }, 20_000)

    it('cria loja com category explicito', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)
      const slug = uniqueSlug('categoria')

      const res = await app.request('/stores', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: 'Padaria Teste',
          slug,
          latitude: -23.55,
          longitude: -46.63,
          category: 'PADARIA',
        }),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { store: { id: string; category: string } }
      expect(body.store.category).toBe('PADARIA')
      createdStoreIds.push(body.store.id)
    }, 20_000)

    it('BUYER tentando criar loja recebe 403', async () => {
      const fixture = await createFixtureUser('BUYER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)

      const res = await app.request('/stores', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: 'Loja de Buyer',
          slug: uniqueSlug('buyer'),
          latitude: -23.55,
          longitude: -46.63,
        }),
      })
      expect(res.status).toBe(403)
    }, 20_000)

    it('slug duplicado retorna 409', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)
      const slug = uniqueSlug('duplicado')

      const first = await app.request('/stores', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'Primeira', slug, latitude: -23.55, longitude: -46.63 }),
      })
      expect(first.status).toBe(201)
      const firstBody = (await first.json()) as { store: { id: string } }
      createdStoreIds.push(firstBody.store.id)

      const second = await app.request('/stores', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'Segunda', slug, latitude: -23.55, longitude: -46.63 }),
      })
      expect(second.status).toBe(409)
    }, 20_000)

    it('body invalido (slug com maiuscula) retorna 400 e nao escreve no banco', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)
      const slug = uniqueSlug('Invalido').toUpperCase()

      const res = await app.request('/stores', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'Loja', slug, latitude: -23.55, longitude: -46.63 }),
      })
      expect(res.status).toBe(400)

      const dbStore = await prisma.store.findFirst({ where: { slug } })
      expect(dbStore).toBeNull()
    }, 20_000)

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
  })

  describe('GET /stores/:id', () => {
    it('retorna a loja sem autenticacao (200)', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const store = await prisma.store.create({
        data: {
          ownerId: fixture.user.id,
          name: 'Loja Publica',
          slug: uniqueSlug('publica'),
          latitude: -23.55,
          longitude: -46.63,
        },
      })
      createdStoreIds.push(store.id)

      const res = await app.request(`/stores/${store.id}`)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { store: { id: string; category: string } }
      expect(body.store.id).toBe(store.id)
      expect(body.store.category).toBe('OUTROS')
    }, 20_000)

    it('loja inexistente retorna 404', async () => {
      const res = await app.request('/stores/00000000-0000-0000-0000-000000000000')
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /stores/:id', () => {
    it('dono atualiza a propria loja (200, campos atualizados)', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)
      const store = await prisma.store.create({
        data: {
          ownerId: fixture.user.id,
          name: 'Nome Antigo',
          slug: uniqueSlug('dono'),
          latitude: -23.55,
          longitude: -46.63,
        },
      })
      createdStoreIds.push(store.id)

      const res = await app.request(`/stores/${store.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'Nome Novo' }),
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { store: { name: string } }
      expect(body.store.name).toBe('Nome Novo')
    }, 20_000)

    it('dono atualiza category da loja (200)', async () => {
      const fixture = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(fixture.authUserId)
      const token = await loginToken(fixture.email, fixture.password)
      const store = await prisma.store.create({
        data: {
          ownerId: fixture.user.id,
          name: 'Loja Categoria',
          slug: uniqueSlug('categoria-patch'),
          latitude: -23.55,
          longitude: -46.63,
        },
      })
      createdStoreIds.push(store.id)

      const res = await app.request(`/stores/${store.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ category: 'FARMACIA' }),
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { store: { category: string } }
      expect(body.store.category).toBe('FARMACIA')
    }, 20_000)

    it('outro STORE_OWNER (dono de loja diferente) recebe 403', async () => {
      const owner = await createFixtureUser('STORE_OWNER')
      const other = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(owner.authUserId, other.authUserId)
      const otherToken = await loginToken(other.email, other.password)

      const store = await prisma.store.create({
        data: {
          ownerId: owner.user.id,
          name: 'Loja Do Owner',
          slug: uniqueSlug('outro-dono'),
          latitude: -23.55,
          longitude: -46.63,
        },
      })
      createdStoreIds.push(store.id)

      const res = await app.request(`/stores/${store.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${otherToken}` },
        body: JSON.stringify({ name: 'Tentativa De Invasao' }),
      })
      expect(res.status).toBe(403)
    }, 20_000)

    it('ADMIN (nao dono) pode editar qualquer loja (200)', async () => {
      const owner = await createFixtureUser('STORE_OWNER')
      const admin = await createFixtureUser('ADMIN')
      createdAuthUserIds.push(owner.authUserId, admin.authUserId)
      const adminToken = await loginToken(admin.email, admin.password)

      const store = await prisma.store.create({
        data: {
          ownerId: owner.user.id,
          name: 'Loja Original',
          slug: uniqueSlug('admin-edita'),
          latitude: -23.55,
          longitude: -46.63,
        },
      })
      createdStoreIds.push(store.id)

      const res = await app.request(`/stores/${store.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ name: 'Editado Pelo Admin' }),
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { store: { name: string } }
      expect(body.store.name).toBe('Editado Pelo Admin')
    }, 20_000)
  })

  describe('logo da loja', () => {
    const STORE_LOGOS_BUCKET = 'store-logos'

    const tinyJpeg = async (): Promise<Buffer> => {
      const sharp = (await import('sharp')).default
      return sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 10, g: 200, b: 30 } } })
        .jpeg()
        .toBuffer()
    }

    const buildFormData = (file: Buffer, filename: string, type: string) => {
      const formData = new FormData()
      formData.append('file', new File([new Uint8Array(file)], filename, { type }))
      return formData
    }

    const pathFromUrl = (url: string): string => {
      const marker = `/${STORE_LOGOS_BUCKET}/`
      return url.slice(url.indexOf(marker) + marker.length)
    }

    const createStoreFixture = async (ownerId: string) => {
      const store = await prisma.store.create({
        data: {
          ownerId,
          name: 'Loja Logo',
          slug: uniqueSlug('logo'),
          latitude: -23.55,
          longitude: -46.63,
        },
      })
      createdStoreIds.push(store.id)
      return store
    }

    it('dono da loja envia logo com sucesso (200) e logoUrl fica salvo', async () => {
      const owner = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(owner.authUserId)
      const store = await createStoreFixture(owner.user.id)
      const token = await loginToken(owner.email, owner.password)

      const jpeg = await tinyJpeg()
      const res = await app.request(`/me/stores/${store.id}/logo`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: buildFormData(jpeg, 'logo.jpg', 'image/jpeg'),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { store: { logoUrl: string } }
      expect(body.store.logoUrl).toMatch(/^https?:\/\//)

      const { supabaseAdmin } = await import('../lib/supabaseClient')
      await supabaseAdmin.storage.from(STORE_LOGOS_BUCKET).remove([pathFromUrl(body.store.logoUrl)])

      const dbStore = await prisma.store.findUnique({ where: { id: store.id } })
      expect(dbStore?.logoUrl).toBe(body.store.logoUrl)
    }, 30_000)

    it('usuario que nao e dono da loja recebe 403 ao enviar logo', async () => {
      const owner = await createFixtureUser('STORE_OWNER')
      const other = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(owner.authUserId, other.authUserId)
      const store = await createStoreFixture(owner.user.id)
      const token = await loginToken(other.email, other.password)

      const jpeg = await tinyJpeg()
      const res = await app.request(`/me/stores/${store.id}/logo`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: buildFormData(jpeg, 'logo.jpg', 'image/jpeg'),
      })
      expect(res.status).toBe(403)
    }, 30_000)

    it('DELETE remove o logo e limpa logoUrl', async () => {
      const owner = await createFixtureUser('STORE_OWNER')
      createdAuthUserIds.push(owner.authUserId)
      const store = await createStoreFixture(owner.user.id)
      const token = await loginToken(owner.email, owner.password)

      const jpeg = await tinyJpeg()
      const uploadRes = await app.request(`/me/stores/${store.id}/logo`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: buildFormData(jpeg, 'logo.jpg', 'image/jpeg'),
      })
      expect(uploadRes.status).toBe(200)

      const res = await app.request(`/me/stores/${store.id}/logo`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { store: { logoUrl: string | null } }
      expect(body.store.logoUrl).toBeNull()

      const dbStore = await prisma.store.findUnique({ where: { id: store.id } })
      expect(dbStore?.logoUrl).toBeNull()
    }, 30_000)
  })
})
