import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { prisma } from '../lib/prismaClient'
import { requireUser, requireStoreOwner, type AuthEnv } from '../middleware/auth'
import { API_ORDER_STATUSES, isValidOrderTransition, orderStatusLabel } from '../../lib/orderStatus'
import { createNotification } from '../lib/notifications'
import { formatCents } from '../../lib/money'

export const orderRoutes = new Hono<AuthEnv>()

/**
 * Lancado dentro da transacao de checkout quando o decremento condicional de
 * estoque (`updateMany` com `stock >= quantity`) afeta 0 linhas — sinal real
 * de que aquele item especifico ficou sem estoque suficiente. Carrega os
 * itens afetados para reproduzir o mesmo formato de resposta 409 usado na
 * checagem pre-transacao.
 */
class InsufficientStockError extends Error {
  constructor(public items: Array<{ productId: string }>) {
    super('Estoque insuficiente')
    this.name = 'InsufficientStockError'
  }
}

/** Mesmo padrao de `parseJsonBody` em `src/server/routes/stores.ts`. */
async function parseJsonBody(c: Context<AuthEnv>): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return undefined
  }
}

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive('Quantidade deve ser um inteiro positivo'),
      }),
    )
    .nonempty('O carrinho precisa ter ao menos um item'),
  addressId: z.string().min(1),
  isGift: z.boolean().optional(),
  giftRecipientName: z.string().trim().min(1).optional(),
  giftMessage: z.string().optional(),
})

orderRoutes.post('/orders', requireUser, async (c) => {
  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = createOrderSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const authedUser = c.get('authedUser')
  const { addressId, isGift, giftRecipientName, giftMessage } = parsed.data

  // isGift=true exige giftRecipientName (nome de quem vai receber o presente)
  // — checagem manual pois o schema acima trata o campo como opcional para
  // não travar pedidos comuns (isGift ausente/false).
  if (isGift && !giftRecipientName) {
    return c.json({ error: 'Dados invalidos', details: { giftRecipientName: 'Nome de quem vai receber é obrigatório' } }, 400)
  }

  // Consolida entradas duplicadas do mesmo productId somando as quantidades,
  // ANTES de qualquer checagem de estoque ou agrupamento por loja. Sem isso,
  // duas linhas do mesmo produto seriam validadas isoladamente contra o
  // estoque total (cada uma passando a checagem individualmente) mesmo que a
  // soma real excedesse o estoque disponivel.
  const quantityByProductId = new Map<string, number>()
  for (const item of parsed.data.items) {
    quantityByProductId.set(item.productId, (quantityByProductId.get(item.productId) ?? 0) + item.quantity)
  }
  const items = Array.from(quantityByProductId, ([productId, quantity]) => ({ productId, quantity }))

  // Endereco precisa pertencer ao usuario autenticado. 404 tanto se nao
  // existir quanto se for de outro usuario, para nao vazar existencia de
  // endereco alheio.
  const address = await prisma.address.findUnique({ where: { id: addressId } })
  if (!address || address.userId !== authedUser.id) {
    return c.json({ error: 'Endereco nao encontrado' }, 404)
  }

  const productIds = items.map((item) => item.productId)
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
  const productById = new Map(products.map((product) => [product.id, product]))

  for (const item of items) {
    const product = productById.get(item.productId)
    if (!product || !product.isActive) {
      return c.json({ error: 'Produto nao encontrado', productId: item.productId }, 404)
    }
  }

  // Checagem de estoque ANTES da transacao: se algum item nao tiver estoque
  // suficiente, nenhum Order e criado (falha atomica do carrinho inteiro).
  // A transacao abaixo tambem decrementa o estoque de forma condicional
  // (WHERE stock >= quantity via updateMany) para cobrir a corrida entre
  // esta checagem e a escrita — se uma requisicao concorrente esgotar o
  // estoque nesse intervalo, a transacao inteira reverte.
  const insufficientStock = items
    .map((item) => ({ item, product: productById.get(item.productId) }))
    .filter(({ item, product }) => (product?.stock ?? 0) < item.quantity)

  if (insufficientStock.length > 0) {
    return c.json(
      {
        error: 'Estoque insuficiente',
        items: insufficientStock.map(({ item }) => ({ productId: item.productId })),
      },
      409,
    )
  }

  // Agrupa os itens por loja — decisao de design da Fase 6: um carrinho
  // multi-loja gera um Order por loja distinta, nao um Order unico.
  const itemsByStore = new Map<string, Array<{ productId: string; quantity: number; unitPriceCents: number }>>()
  for (const item of items) {
    const product = productById.get(item.productId)
    if (!product) continue
    const existing = itemsByStore.get(product.storeId) ?? []
    existing.push({ productId: item.productId, quantity: item.quantity, unitPriceCents: product.priceCents })
    itemsByStore.set(product.storeId, existing)
  }

  // Ordem de lock deterministica: achata todos os itens (de todas as lojas)
  // em um unico array ordenado por productId. Sem isso, dois carrinhos
  // concorrentes com os mesmos produtos em ordem oposta no array `items` do
  // request travariam as linhas em ordem inversa, causando deadlock no
  // Postgres. Os decrementos rodam ANTES dos `order.create`/`orderItem.create`
  // dentro da mesma transacao para reduzir o tempo que os locks ficam presos.
  const allItemsSorted = Array.from(quantityByProductId, ([productId, quantity]) => ({ productId, quantity })).sort(
    (a, b) => a.productId.localeCompare(b.productId),
  )

  try {
    const orders = await prisma.$transaction(async (tx) => {
      for (const item of allItemsSorted) {
        // `updateMany` com `stock: { gte: quantity }` no WHERE torna o
        // decremento condicional: se a corrida com outra requisicao ja
        // consumiu o estoque entre a checagem acima e aqui, nenhuma linha
        // e afetada e o `count` fica 0, disparando o rollback abaixo.
        const result = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        })
        if (result.count === 0) {
          throw new InsufficientStockError([{ productId: item.productId }])
        }
      }

      const createdOrders = []
      for (const [storeId, storeItems] of itemsByStore) {
        const totalCents = storeItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)
        const order = await tx.order.create({
          data: {
            buyerId: authedUser.id,
            storeId,
            addressId,
            totalCents,
            isGift: isGift ?? false,
            giftRecipientName: isGift ? giftRecipientName : undefined,
            giftMessage: isGift ? giftMessage : undefined,
            items: {
              create: storeItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPriceCents: item.unitPriceCents,
              })),
            },
          },
          include: { items: true },
        })
        createdOrders.push(order)
      }
      return createdOrders
    })

    // Notificacoes best-effort: nunca bloqueiam nem revertem a resposta —
    // o pedido ja foi criado com sucesso quando chegamos aqui.
    await createNotification(authedUser.id, {
      title: 'Pedido confirmado',
      message:
        orders.length > 1
          ? `Seus ${orders.length} pedidos foram confirmados (um por loja).`
          : 'Pedido confirmado! Acompanhe em Meus pedidos.',
      type: 'SUCCESS',
      href: '/pedidos',
    })

    const stores = await prisma.store.findMany({
      where: { id: { in: orders.map((order) => order.storeId) } },
      select: { id: true, ownerId: true },
    })
    const ownerIdByStoreId = new Map(stores.map((store) => [store.id, store.ownerId]))
    await Promise.all(
      orders.map((order) => {
        const ownerId = ownerIdByStoreId.get(order.storeId)
        if (!ownerId) return Promise.resolve()
        return createNotification(ownerId, {
          title: 'Novo pedido recebido',
          message: `Novo pedido de ${formatCents(order.totalCents)}.`,
          type: 'INFO',
          href: '/minha-loja',
        })
      }),
    )

    return c.json({ orders }, 201)
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      console.error('Checkout: estoque insuficiente durante a transacao', {
        items: err.items,
        buyerId: authedUser.id,
      })
      return c.json({ error: 'Estoque insuficiente', items: err.items }, 409)
    }
    console.error('Checkout: erro inesperado na transacao', err)
    return c.json({ error: 'Erro interno' }, 500)
  }
})

const updateStatusSchema = z.object({
  status: z.enum(API_ORDER_STATUSES),
})

/**
 * Dono da loja do pedido (ou ADMIN) avanca o status seguindo a maquina de
 * estados de `src/lib/orderStatus.ts`. 403 se a loja nao for do usuario;
 * 409 (pt-BR) em transicao invalida.
 */
orderRoutes.patch('/orders/:id/status', requireUser, requireStoreOwner, async (c) => {
  const id = c.req.param('id')
  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = updateStatusSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { store: true } })
  if (!order) {
    return c.json({ error: 'Pedido nao encontrado' }, 404)
  }

  const authedUser = c.get('authedUser')
  if (authedUser.role !== 'ADMIN' && order.store.ownerId !== authedUser.id) {
    return c.json({ error: 'Voce nao tem permissao para atualizar este pedido' }, 403)
  }

  const nextStatus = parsed.data.status
  if (!isValidOrderTransition(order.status, nextStatus)) {
    return c.json(
      {
        error: `Transição de status inválida: um pedido "${orderStatusLabel(order.status)}" não pode ir para "${orderStatusLabel(nextStatus)}".`,
      },
      409,
    )
  }

  // Escrita condicional: o WHERE inclui o status lido acima, entao uma
  // requisicao concorrente que ja mudou o pedido faz o count cair para 0 e
  // este PATCH responde 409 em vez de sobrescrever cegamente.
  const result = await prisma.order.updateMany({
    where: { id, status: order.status },
    data: { status: nextStatus },
  })
  if (result.count === 0) {
    return c.json({ error: 'O pedido mudou de status enquanto você atualizava. Recarregue e tente de novo.' }, 409)
  }

  const updated = await prisma.order.findUnique({ where: { id }, include: { items: true } })
  return c.json({ order: updated })
})

orderRoutes.get('/me/orders', requireUser, async (c) => {
  const authedUser = c.get('authedUser')
  const orders = await prisma.order.findMany({
    where: { buyerId: authedUser.id },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  })
  return c.json({ orders })
})
