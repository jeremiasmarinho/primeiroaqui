import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { prisma } from '../lib/prismaClient'
import { requireUser, type AuthEnv } from '../middleware/auth'

export const orderRoutes = new Hono<AuthEnv>()

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
  const { items, addressId } = parsed.data

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

  try {
    const orders = await prisma.$transaction(async (tx) => {
      const createdOrders = []
      for (const [storeId, storeItems] of itemsByStore) {
        const totalCents = storeItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)
        const order = await tx.order.create({
          data: {
            buyerId: authedUser.id,
            storeId,
            addressId,
            totalCents,
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

        for (const item of storeItems) {
          // `updateMany` com `stock: { gte: quantity }` no WHERE torna o
          // decremento condicional: se a corrida com outra requisicao ja
          // consumiu o estoque entre a checagem acima e aqui, nenhuma linha
          // e afetada e o `count` fica 0, disparando o rollback abaixo.
          const result = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          })
          if (result.count === 0) {
            throw new Error('Estoque insuficiente durante a transacao (corrida concorrente)')
          }
        }
      }
      return createdOrders
    })

    return c.json({ orders }, 201)
  } catch {
    return c.json({ error: 'Estoque insuficiente' }, 409)
  }
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
