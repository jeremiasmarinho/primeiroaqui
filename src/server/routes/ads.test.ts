import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

describe('rota publica de anuncios', () => {
  afterEach(async () => {
    await prisma.adPlacement.deleteMany({ where: { advertiserName: { startsWith: 'Fixture ' } } })
  })

  const hourAgo = () => new Date(Date.now() - 60 * 60 * 1000)
  const hourAhead = () => new Date(Date.now() + 60 * 60 * 1000)

  describe('GET /ads', () => {
    it('retorna listas vazias quando nao ha anuncios vigentes', async () => {
      const res = await app.request('/ads')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({ heroCarousel: [], highlightStrip: null, sponsoredFeed: [] })
    })

    it('filtra anuncio expirado, agendado no futuro e inativo', async () => {
      await prisma.adPlacement.create({
        data: {
          slot: 'HERO_CAROUSEL',
          advertiserName: 'Fixture Expirado',
          imageUrl: 'https://x.com/a.png',
          startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          endsAt: hourAgo(),
        },
      })
      await prisma.adPlacement.create({
        data: {
          slot: 'HERO_CAROUSEL',
          advertiserName: 'Fixture Agendado',
          imageUrl: 'https://x.com/b.png',
          startsAt: hourAhead(),
          endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        },
      })
      await prisma.adPlacement.create({
        data: {
          slot: 'HERO_CAROUSEL',
          advertiserName: 'Fixture Inativo',
          imageUrl: 'https://x.com/c.png',
          startsAt: hourAgo(),
          endsAt: hourAhead(),
          active: false,
        },
      })

      const res = await app.request('/ads')
      const body = (await res.json()) as { heroCarousel: unknown[] }
      expect(body.heroCarousel).toEqual([])
    })

    it('agrupa por slot e ordena por position', async () => {
      await prisma.adPlacement.create({
        data: {
          slot: 'SPONSORED_FEED',
          advertiserName: 'Fixture Feed 2',
          imageUrl: 'https://x.com/f2.png',
          startsAt: hourAgo(),
          endsAt: hourAhead(),
          position: 2,
        },
      })
      await prisma.adPlacement.create({
        data: {
          slot: 'SPONSORED_FEED',
          advertiserName: 'Fixture Feed 1',
          imageUrl: 'https://x.com/f1.png',
          startsAt: hourAgo(),
          endsAt: hourAhead(),
          position: 1,
        },
      })

      const res = await app.request('/ads')
      const body = (await res.json()) as { sponsoredFeed: Array<{ advertiserName: string }> }
      expect(body.sponsoredFeed.map((a) => a.advertiserName)).toEqual(['Fixture Feed 1', 'Fixture Feed 2'])
    })

    it('highlightStrip retorna o de menor position', async () => {
      await prisma.adPlacement.create({
        data: {
          slot: 'HIGHLIGHT_STRIP',
          advertiserName: 'Fixture Highlight 2',
          imageUrl: 'https://x.com/h2.png',
          startsAt: hourAgo(),
          endsAt: hourAhead(),
          position: 5,
        },
      })
      await prisma.adPlacement.create({
        data: {
          slot: 'HIGHLIGHT_STRIP',
          advertiserName: 'Fixture Highlight 1',
          imageUrl: 'https://x.com/h1.png',
          startsAt: hourAgo(),
          endsAt: hourAhead(),
          position: 1,
        },
      })

      const res = await app.request('/ads')
      const body = (await res.json()) as { highlightStrip: { advertiserName: string } | null }
      expect(body.highlightStrip?.advertiserName).toBe('Fixture Highlight 1')
    })
  })
})

describe('CRUD admin de anuncios', () => {
  let adminFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let buyerFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let adminToken: string
  let buyerToken: string

  const hourAgo = () => new Date(Date.now() - 60 * 60 * 1000)
  const hourAhead = () => new Date(Date.now() + 60 * 60 * 1000)

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
    adminToken = await loginToken(adminFixture.email, adminFixture.password)
    buyerToken = await loginToken(buyerFixture.email, buyerFixture.password)
  }, 30_000)

  afterAll(async () => {
    await Promise.all([
      deleteFixtureUser(adminFixture.authUserId),
      deleteFixtureUser(buyerFixture.authUserId),
    ])
  })

  afterEach(async () => {
    await prisma.adPlacement.deleteMany({ where: { advertiserName: { startsWith: 'Fixture ' } } })
  })

  const validPayload = () => ({
    slot: 'HERO_CAROUSEL' as const,
    advertiserName: 'Fixture Admin CRUD',
    imageUrl: 'https://x.com/admin.png',
    startsAt: hourAgo().toISOString(),
    endsAt: hourAhead().toISOString(),
  })

  describe('controle de acesso', () => {
    it.each([
      ['GET', '/admin/ads'],
      ['POST', '/admin/ads'],
      ['PATCH', '/admin/ads/00000000-0000-0000-0000-000000000000'],
      ['DELETE', '/admin/ads/00000000-0000-0000-0000-000000000000'],
    ])('%s %s exige ADMIN', async (method, path) => {
      const anon = await app.request(path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'POST' || method === 'PATCH' ? JSON.stringify(validPayload()) : undefined,
      })
      expect(anon.status).toBe(401)

      const res = await app.request(path, {
        method,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: method === 'POST' || method === 'PATCH' ? JSON.stringify(validPayload()) : undefined,
      })
      expect(res.status).toBe(403)
    }, 20_000)
  })

  describe('POST /admin/ads', () => {
    it('cria e devolve 201', async () => {
      const res = await app.request('/admin/ads', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(validPayload()),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { ad: { id: string; advertiserName: string } }
      expect(body.ad.advertiserName).toBe('Fixture Admin CRUD')
      expect(body.ad.id).toBeTruthy()
    })

    it('endsAt <= startsAt retorna 400', async () => {
      const payload = validPayload()
      const res = await app.request('/admin/ads', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ ...payload, startsAt: hourAhead().toISOString(), endsAt: hourAgo().toISOString() }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('PATCH /admin/ads/:id', () => {
    it('altera active', async () => {
      const created = await prisma.adPlacement.create({
        data: {
          slot: 'HERO_CAROUSEL',
          advertiserName: 'Fixture Patch Alvo',
          imageUrl: 'https://x.com/patch.png',
          startsAt: hourAgo(),
          endsAt: hourAhead(),
          active: true,
        },
      })

      const res = await app.request(`/admin/ads/${created.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ active: false }),
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { ad: { active: boolean } }
      expect(body.ad.active).toBe(false)
    })
  })

  describe('DELETE /admin/ads/:id', () => {
    it('remove o anuncio', async () => {
      const created = await prisma.adPlacement.create({
        data: {
          slot: 'HERO_CAROUSEL',
          advertiserName: 'Fixture Delete Alvo',
          imageUrl: 'https://x.com/delete.png',
          startsAt: hourAgo(),
          endsAt: hourAhead(),
        },
      })

      const res = await app.request(`/admin/ads/${created.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${adminToken}` },
      })
      expect(res.status).toBe(200)
      expect(await prisma.adPlacement.findUnique({ where: { id: created.id } })).toBeNull()
    })
  })

  describe('GET /admin/ads', () => {
    it('lista inclusive inativos/expirados', async () => {
      await prisma.adPlacement.create({
        data: {
          slot: 'HERO_CAROUSEL',
          advertiserName: 'Fixture Admin Inativo',
          imageUrl: 'https://x.com/inativo.png',
          startsAt: hourAgo(),
          endsAt: hourAgo(),
          active: false,
        },
      })

      const res = await app.request('/admin/ads', {
        headers: { authorization: `Bearer ${adminToken}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { ads: Array<{ advertiserName: string }> }
      expect(body.ads.some((a) => a.advertiserName === 'Fixture Admin Inativo')).toBe(true)
    })
  })
})
