import { afterEach, describe, expect, it } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'

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
