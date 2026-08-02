import { Hono } from 'hono'
import { prisma } from '../lib/prismaClient'
import { requireUser, type AuthEnv } from '../middleware/auth'

export const favoriteRoutes = new Hono<AuthEnv>()

favoriteRoutes.post('/favorites/:productId', requireUser, async (c) => {
  const productId = c.req.param('productId')
  if (!productId) {
    return c.json({ error: 'Produto nao encontrado' }, 404)
  }
  const authedUser = c.get('authedUser')

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product || !product.isActive) {
    return c.json({ error: 'Produto nao encontrado' }, 404)
  }

  // Idempotente: favoritar de novo nao e uma condicao de erro. `upsert` com
  // `update: {}` evita erro de chave duplicada na corrida entre o `create` e
  // uma segunda chamada concorrente para o mesmo par (userId, productId).
  await prisma.favorite.upsert({
    where: { userId_productId: { userId: authedUser.id, productId } },
    create: { userId: authedUser.id, productId },
    update: {},
  })

  return c.json({ ok: true }, 200)
})

favoriteRoutes.delete('/favorites/:productId', requireUser, async (c) => {
  const productId = c.req.param('productId')
  if (!productId) {
    return c.json({ error: 'Produto nao encontrado' }, 404)
  }
  const authedUser = c.get('authedUser')

  // Idempotente: remover algo que ja nao existe nao e erro. `deleteMany` nao
  // lanca quando nao ha registro correspondente.
  await prisma.favorite.deleteMany({ where: { userId: authedUser.id, productId } })

  return c.json({ ok: true }, 200)
})

favoriteRoutes.get('/me/favorites', requireUser, async (c) => {
  const authedUser = c.get('authedUser')

  const favorites = await prisma.favorite.findMany({
    where: { userId: authedUser.id },
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        include: { photos: { orderBy: { position: 'asc' }, take: 1 } },
      },
    },
  })

  return c.json({
    products: favorites.map(({ product }) => ({
      id: product.id,
      storeId: product.storeId,
      title: product.title,
      priceCents: product.priceCents,
      isActive: product.isActive,
      photoUrl: product.photos[0]?.url ?? null,
    })),
  })
})
