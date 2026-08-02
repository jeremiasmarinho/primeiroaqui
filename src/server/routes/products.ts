import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { prisma } from '../lib/prismaClient'
import { searchProductIds } from '../lib/productSearch'
import { requireUser, requireStoreOwner, type AuthEnv } from '../middleware/auth'

export const productRoutes = new Hono<AuthEnv>()

/** Mesmo padrao de `parseJsonBody` em `src/server/routes/stores.ts`. */
async function parseJsonBody(c: Context<AuthEnv>): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return undefined
  }
}

const createProductSchema = z.object({
  title: z.string().trim().min(1, 'Titulo nao pode ser vazio'),
  description: z.string().optional(),
  category: z.string().trim().min(1, 'Categoria nao pode ser vazia'),
  priceCents: z.number().int().positive('Preco deve ser um inteiro positivo'),
  stock: z.number().int().min(0, 'Estoque nao pode ser negativo').default(0),
})

const updateProductSchema = z
  .object({
    title: z.string().trim().min(1, 'Titulo nao pode ser vazio'),
    description: z.string().optional(),
    category: z.string().trim().min(1, 'Categoria nao pode ser vazia'),
    priceCents: z.number().int().positive('Preco deve ser um inteiro positivo'),
    stock: z.number().int().min(0, 'Estoque nao pode ser negativo'),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Ao menos um campo deve ser informado',
  })

const listProductsQuerySchema = z
  .object({
    category: z.string().trim().min(1).optional(),
    q: z.string().trim().min(1).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine(
    (data) => {
      const geoFields = [data.lat, data.lng, data.radiusKm]
      const providedCount = geoFields.filter((field) => field !== undefined).length
      return providedCount === 0 || providedCount === 3
    },
    { message: '`lat`, `lng` e `radiusKm` devem ser informados juntos ou nenhum deles' },
  )

type ProductRecord = {
  id: string
  storeId: string
  title: string
  description: string | null
  category: string
  priceCents: number
  stock: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/** Campos publicos de um produto. */
function toPublicProduct(product: ProductRecord) {
  return {
    id: product.id,
    storeId: product.storeId,
    title: product.title,
    description: product.description,
    category: product.category,
    priceCents: product.priceCents,
    stock: product.stock,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  }
}

/**
 * Verifica se a loja existe, esta ativa (irrelevante para o dono/admin
 * escrever) e se o usuario autenticado pode operar sobre ela (dono ou
 * ADMIN). Mesmo padrao de posse usado em `stores.ts`, agora aplicado a
 * `store.ownerId` a partir do `storeId` do produto/URL.
 */
function canOperateOnStore(
  authedUser: { id: string; role: 'BUYER' | 'STORE_OWNER' | 'ADMIN' },
  ownerId: string,
): boolean {
  return authedUser.role === 'ADMIN' || authedUser.id === ownerId
}

productRoutes.post('/stores/:storeId/products', requireUser, requireStoreOwner, async (c) => {
  const storeId = c.req.param('storeId')
  if (!storeId) {
    return c.json({ error: 'Loja nao encontrada' }, 404)
  }
  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = createProductSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const store = await prisma.store.findUnique({ where: { id: storeId } })
  if (!store) {
    return c.json({ error: 'Loja nao encontrada' }, 404)
  }

  const authedUser = c.get('authedUser')
  if (!canOperateOnStore(authedUser, store.ownerId)) {
    return c.json({ error: 'Voce nao tem permissao para cadastrar produtos nesta loja' }, 403)
  }

  const { title, description, category, priceCents, stock } = parsed.data
  const product = await prisma.product.create({
    data: { storeId, title, description, category, priceCents, stock },
  })
  return c.json({ product: toPublicProduct(product) }, 201)
})

productRoutes.get('/products', async (c) => {
  const parsed = listProductsQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: 'Parametros invalidos', details: parsed.error.flatten() }, 400)
  }
  const { category, q, lat, lng, radiusKm, limit, offset } = parsed.data

  if (q === undefined && lat === undefined) {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        store: { isActive: true },
        ...(category !== undefined ? { category } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: limit,
      skip: offset,
    })
    return c.json({ products: products.map(toPublicProduct) })
  }

  const ids = await searchProductIds({ category, q, lat, lng, radiusKm, limit, offset })
  const products = await prisma.product.findMany({ where: { id: { in: ids } } })
  const byId = new Map(products.map((product) => [product.id, product]))
  const ordered = ids.map((id) => byId.get(id)).filter((product): product is ProductRecord => product !== undefined)
  return c.json({ products: ordered.map(toPublicProduct) })
})

productRoutes.get('/products/:id', async (c) => {
  const id = c.req.param('id')
  const product = await prisma.product.findUnique({ where: { id }, include: { store: true } })
  if (!product || !product.isActive || !product.store.isActive) {
    return c.json({ error: 'Produto nao encontrado' }, 404)
  }
  return c.json({ product: toPublicProduct(product) })
})

productRoutes.patch('/products/:id', requireUser, requireStoreOwner, async (c) => {
  const id = c.req.param('id')
  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = updateProductSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const product = await prisma.product.findUnique({ where: { id }, include: { store: true } })
  if (!product) {
    return c.json({ error: 'Produto nao encontrado' }, 404)
  }

  const authedUser = c.get('authedUser')
  if (!canOperateOnStore(authedUser, product.store.ownerId)) {
    return c.json({ error: 'Voce nao tem permissao para editar este produto' }, 403)
  }

  const { title, description, category, priceCents, stock } = parsed.data
  const updated = await prisma.product.update({
    where: { id },
    data: { title, description, category, priceCents, stock },
  })
  return c.json({ product: toPublicProduct(updated) })
})

productRoutes.delete('/products/:id', requireUser, requireStoreOwner, async (c) => {
  const id = c.req.param('id')
  const product = await prisma.product.findUnique({ where: { id }, include: { store: true } })
  if (!product) {
    return c.json({ error: 'Produto nao encontrado' }, 404)
  }

  const authedUser = c.get('authedUser')
  if (!canOperateOnStore(authedUser, product.store.ownerId)) {
    return c.json({ error: 'Voce nao tem permissao para remover este produto' }, 403)
  }

  // Soft-delete: produtos com `OrderItem` associados nao podem ser removidos
  // fisicamente sem quebrar o historico de pedidos.
  const updated = await prisma.product.update({ where: { id }, data: { isActive: false } })
  return c.json({ product: toPublicProduct(updated) })
})
