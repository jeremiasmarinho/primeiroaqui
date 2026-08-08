import { Hono } from 'hono'
import { prisma } from '../lib/prismaClient'
import { requireUser, requireAdmin, type AuthEnv } from '../middleware/auth'

export const adminRoutes = new Hono<AuthEnv>()

/** Dia (UTC) de um Date no formato YYYY-MM-DD — chave do agregado diário. */
const toDayKey = (date: Date): string => date.toISOString().slice(0, 10)

/**
 * Visão geral da plataforma para o painel admin.
 *
 * GMV = somatório de `totalCents` de todos os pedidos NÃO cancelados —
 * pedido cancelado não vira dinheiro, então não conta. A série de 30 dias é
 * agregada em memória (volume de MVP; quando doer, vira GROUP BY date_trunc).
 */
adminRoutes.get('/admin/metrics', requireUser, requireAdmin, async (c) => {
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  since.setUTCDate(since.getUTCDate() - 29)

  const [users, stores, activeStores, products, orders, gmv, byStatus, recentOrders] =
    await Promise.all([
      prisma.user.count(),
      prisma.store.count(),
      prisma.store.count({ where: { isActive: true } }),
      prisma.product.count(),
      prisma.order.count(),
      prisma.order.aggregate({
        _sum: { totalCents: true },
        where: { status: { not: 'CANCELED' } },
      }),
      prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.order.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, totalCents: true, status: true },
      }),
    ])

  const ordersByStatus: Record<string, number> = {}
  for (const row of byStatus) ordersByStatus[row.status] = row._count._all

  // Série completa (30 posições, zero preenchida): a UI plota direto, sem
  // precisar inventar os dias sem venda.
  const days = new Map<string, { date: string; orders: number; gmvCents: number }>()
  for (let i = 0; i < 30; i++) {
    const day = new Date(since)
    day.setUTCDate(since.getUTCDate() + i)
    const key = toDayKey(day)
    days.set(key, { date: key, orders: 0, gmvCents: 0 })
  }
  for (const order of recentOrders) {
    const bucket = days.get(toDayKey(order.createdAt))
    if (!bucket) continue
    bucket.orders += 1
    if (order.status !== 'CANCELED') bucket.gmvCents += order.totalCents
  }

  return c.json({
    totals: {
      users,
      stores,
      activeStores,
      products,
      orders,
      gmvCents: gmv._sum.totalCents ?? 0,
    },
    ordersByStatus,
    last30Days: Array.from(days.values()),
  })
})

/**
 * Pedidos de toda a plataforma, mais novos primeiro, com comprador, loja e
 * itens — a tabela do painel. Paginação simples por limit/offset; `total`
 * permite o "carregar mais" saber quando parar.
 */
adminRoutes.get('/admin/orders', requireUser, requireAdmin, async (c) => {
  const rawLimit = Number(c.req.query('limit') ?? 20)
  const rawOffset = Number(c.req.query('offset') ?? 0)
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20
  const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        items: true,
        buyer: { select: { name: true } },
        store: { select: { name: true } },
      },
    }),
    prisma.order.count(),
  ])

  return c.json({
    orders: orders.map((order) => ({
      id: order.id,
      buyerId: order.buyerId,
      storeId: order.storeId,
      addressId: order.addressId,
      totalCents: order.totalCents,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items,
      buyerName: order.buyer.name,
      storeName: order.store.name,
      isGift: order.isGift,
      giftRecipientName: order.giftRecipientName,
      giftMessage: order.giftMessage,
    })),
    total,
  })
})

/** Lojas da plataforma com dono e volumes — base da tela de moderação. */
adminRoutes.get('/admin/stores', requireUser, requireAdmin, async (c) => {
  const stores = await prisma.store.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      owner: { select: { name: true } },
      _count: { select: { products: true, orders: true } },
    },
  })
  return c.json({
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
      slug: store.slug,
      category: store.category,
      ownerName: store.owner.name,
      productCount: store._count.products,
      orderCount: store._count.orders,
      isActive: store.isActive,
      createdAt: store.createdAt,
    })),
  })
})

/** Moderação: ativa/desativa uma loja. Só `isActive` — nada além disso muda por aqui. */
adminRoutes.patch('/admin/stores/:id', requireUser, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null)
  const isActive = (body as { isActive?: unknown } | null)?.isActive
  if (typeof isActive !== 'boolean') {
    return c.json({ error: 'Informe isActive como booleano' }, 400)
  }

  const store = await prisma.store.findUnique({ where: { id: c.req.param('id') } })
  if (!store) return c.json({ error: 'Loja nao encontrada' }, 404)

  const updated = await prisma.store.update({
    where: { id: store.id },
    data: { isActive },
  })
  return c.json({
    store: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt,
    },
  })
})
