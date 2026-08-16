import { Hono } from 'hono'
import { prisma } from '../lib/prismaClient'

export const adRoutes = new Hono()

/**
 * Anúncios vigentes da home, agrupados por slot. Público e sem dados de
 * vigência na resposta: o client só precisa saber o que exibir AGORA.
 */
adRoutes.get('/ads', async (c) => {
  const now = new Date()
  const ads = await prisma.adPlacement.findMany({
    where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { position: 'asc' },
    select: { id: true, slot: true, advertiserName: true, imageUrl: true, linkUrl: true, position: true },
  })
  return c.json({
    heroCarousel: ads.filter((a) => a.slot === 'HERO_CAROUSEL'),
    highlightStrip: ads.find((a) => a.slot === 'HIGHLIGHT_STRIP') ?? null,
    sponsoredFeed: ads.filter((a) => a.slot === 'SPONSORED_FEED'),
  })
})
