import { Hono } from 'hono'
import { prisma } from '../lib/prismaClient'
import { requireUser, requireStoreOwner, type AuthEnv } from '../middleware/auth'

export const storeOwnerRoutes = new Hono<AuthEnv>()

/** Campos publicos do usuario — mesmo shape de /auth/login e /me. */
function toPublicUser(user: {
  id: string
  authUserId: string
  email: string
  name: string
  role: 'BUYER' | 'STORE_OWNER' | 'ADMIN'
}) {
  return {
    id: user.id,
    authUserId: user.authUserId,
    email: user.email,
    name: user.name,
    role: user.role,
  }
}

/**
 * Onboarding de lojista: promove BUYER → STORE_OWNER.
 *
 * Sem input algum — a rota NUNCA aceita `role` no body (anti-escalação: o
 * unico salto possivel e BUYER→STORE_OWNER, decidido aqui no servidor).
 * Idempotente: quem ja e STORE_OWNER recebe 200 com o proprio usuario;
 * ADMIN nao e rebaixado nem alterado.
 */
storeOwnerRoutes.post('/me/become-store-owner', requireUser, async (c) => {
  const authedUser = c.get('authedUser')

  if (authedUser.role !== 'BUYER') {
    const user = await prisma.user.findUnique({ where: { id: authedUser.id } })
    if (!user) return c.json({ error: 'Usuario nao encontrado' }, 401)
    return c.json({ user: toPublicUser(user) })
  }

  const updated = await prisma.user.update({
    where: { id: authedUser.id },
    data: { role: 'STORE_OWNER' },
  })
  return c.json({ user: toPublicUser(updated) })
})

/** Lojas do usuario logado (dono). ADMIN ve apenas as proprias — gestao de terceiros e via painel admin, outra fase. */
storeOwnerRoutes.get('/me/stores', requireUser, requireStoreOwner, async (c) => {
  const authedUser = c.get('authedUser')
  const stores = await prisma.store.findMany({
    where: { ownerId: authedUser.id },
    orderBy: { createdAt: 'asc' },
  })
  return c.json({
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
      slug: store.slug,
      description: store.description,
      latitude: store.latitude,
      longitude: store.longitude,
      logoUrl: store.logoUrl,
      isActive: store.isActive,
      giftWrapAvailable: store.giftWrapAvailable,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    })),
  })
})

/**
 * Pedidos recebidos pelas lojas do usuario, mais novos primeiro, com itens e
 * o nome de quem comprou — o que o painel do lojista precisa para operar.
 */
storeOwnerRoutes.get('/me/store-orders', requireUser, requireStoreOwner, async (c) => {
  const authedUser = c.get('authedUser')
  const orders = await prisma.order.findMany({
    where: { store: { ownerId: authedUser.id } },
    orderBy: { createdAt: 'desc' },
    include: { items: true, buyer: { select: { name: true } } },
  })
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
      isGift: order.isGift,
      giftRecipientName: order.giftRecipientName,
      giftMessage: order.giftMessage,
    })),
  })
})

/**
 * CRM basico: clientes que ja compraram de QUALQUER loja do usuario logado,
 * agregados por comprador. Uma unica query (sem N+1) — pedidos ja vem
 * ordenados por criacao desc, entao o primeiro pedido de cada comprador
 * encontrado no loop e o mais recente.
 */
storeOwnerRoutes.get('/me/store-customers', requireUser, requireStoreOwner, async (c) => {
  const authedUser = c.get('authedUser')
  const orders = await prisma.order.findMany({
    where: { store: { ownerId: authedUser.id } },
    orderBy: { createdAt: 'desc' },
    select: {
      buyerId: true,
      totalCents: true,
      status: true,
      createdAt: true,
      buyer: { select: { name: true } },
    },
  })

  type Aggregate = {
    buyerId: string
    name: string
    ordersCount: number
    totalCents: number
    lastOrderAt: Date
    lastOrderStatus: string
  }
  const byBuyer = new Map<string, Aggregate>()

  for (const order of orders) {
    const existing = byBuyer.get(order.buyerId)
    if (existing) {
      existing.ordersCount += 1
      existing.totalCents += order.totalCents
    } else {
      // Primeira ocorrencia para este comprador == pedido mais recente, pois
      // `orders` ja veio ordenado por createdAt desc.
      byBuyer.set(order.buyerId, {
        buyerId: order.buyerId,
        name: order.buyer.name,
        ordersCount: 1,
        totalCents: order.totalCents,
        lastOrderAt: order.createdAt,
        lastOrderStatus: order.status,
      })
    }
  }

  const customers = Array.from(byBuyer.values()).sort(
    (a, b) => b.lastOrderAt.getTime() - a.lastOrderAt.getTime(),
  )

  return c.json({
    customers: customers.map((customer) => ({
      buyerId: customer.buyerId,
      name: customer.name,
      ordersCount: customer.ordersCount,
      totalCents: customer.totalCents,
      lastOrderAt: customer.lastOrderAt,
      lastOrderStatus: customer.lastOrderStatus,
    })),
  })
})
