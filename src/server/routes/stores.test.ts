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
      const body = (await res.json()) as { store: { id: string; slug: string; ownerId?: string } }
      expect(body.store.slug).toBe(slug)
      createdStoreIds.push(body.store.id)

      const dbStore = await prisma.store.findUnique({ where: { id: body.store.id } })
      expect(dbStore?.ownerId).toBe(fixture.user.id)
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
      const body = (await res.json()) as { store: { id: string } }
      expect(body.store.id).toBe(store.id)
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
})
