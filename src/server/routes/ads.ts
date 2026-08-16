import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../lib/prismaClient'
import { requireUser, requireAdmin, type AuthEnv } from '../middleware/auth'

export const adRoutes = new Hono<AuthEnv>()

/** Campos base do anuncio, sem o refine de vigencia — reutilizados em create e update. */
const adBaseSchema = z.object({
  slot: z.enum(['HERO_CAROUSEL', 'HIGHLIGHT_STRIP', 'SPONSORED_FEED']),
  advertiserName: z.string().trim().min(2),
  imageUrl: z.string().regex(/^(https?:\/\/|\/)\S+$/),
  linkUrl: z
    .string()
    .regex(/^(https?:\/\/|\/)\S+$/)
    .nullish(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  active: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
})

/** Schema de criacao: vigencia obrigatoria e coerente (endsAt > startsAt). */
const adInput = adBaseSchema.refine((v) => v.endsAt > v.startsAt, {
  message: 'endsAt deve ser apos startsAt',
})

/** Schema de atualizacao: todos os campos opcionais; refine so roda quando ambas as datas vierem. */
const adUpdateInput = adBaseSchema.partial().refine(
  (v) => {
    if (v.startsAt === undefined || v.endsAt === undefined) return true
    return v.endsAt > v.startsAt
  },
  { message: 'endsAt deve ser apos startsAt' },
)

const parseJsonBody = async (c: { req: { json: () => Promise<unknown> } }): Promise<unknown> => {
  try {
    return await c.req.json()
  } catch {
    return undefined
  }
}

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

/** Lista TODOS os anuncios (inclusive inativos/expirados) — base do CRUD admin. */
adRoutes.get('/admin/ads', requireUser, requireAdmin, async (c) => {
  const ads = await prisma.adPlacement.findMany({
    orderBy: [{ slot: 'asc' }, { position: 'asc' }],
  })
  return c.json({ ads })
})

/** Cria um anuncio. */
adRoutes.post('/admin/ads', requireUser, requireAdmin, async (c) => {
  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = adInput.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const ad = await prisma.adPlacement.create({ data: parsed.data })
  return c.json({ ad }, 201)
})

/** Atualiza um anuncio (parcial). */
adRoutes.patch('/admin/ads/:id', requireUser, requireAdmin, async (c) => {
  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = adUpdateInput.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const existing = await prisma.adPlacement.findUnique({ where: { id: c.req.param('id') } })
  if (!existing) return c.json({ error: 'Anuncio nao encontrado' }, 404)

  const ad = await prisma.adPlacement.update({
    where: { id: existing.id },
    data: parsed.data,
  })
  return c.json({ ad })
})

/** Remove um anuncio. */
adRoutes.delete('/admin/ads/:id', requireUser, requireAdmin, async (c) => {
  const existing = await prisma.adPlacement.findUnique({ where: { id: c.req.param('id') } })
  if (!existing) return c.json({ error: 'Anuncio nao encontrado' }, 404)

  await prisma.adPlacement.delete({ where: { id: existing.id } })
  return c.json({ ok: true })
})
