import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { prisma } from '../lib/prismaClient'
import { requireUser, requireStoreOwner, type AuthEnv } from '../middleware/auth'

export const storeRoutes = new Hono<AuthEnv>()

/**
 * Faz parse do corpo JSON da requisicao sem lancar excecao. Mesmo padrao de
 * `parseJsonBody` em `src/server/routes/auth.ts` — corpo malformado ou
 * ausente retorna `undefined` em vez de propagar o erro do
 * Hono/`Request.json()`, permitindo responder 400 em vez de um 500 nao
 * tratado.
 */
async function parseJsonBody(c: Context<AuthEnv>): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return undefined
  }
}

const slugSchema = z
  .string()
  .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minusculas, numeros e hifen')

const createStoreSchema = z.object({
  name: z.string().trim().min(1, 'Nome nao pode ser vazio'),
  slug: slugSchema,
  description: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
})

const updateStoreSchema = z
  .object({
    name: z.string().trim().min(1, 'Nome nao pode ser vazio'),
    slug: slugSchema,
    description: z.string().optional(),
    latitude: z.number(),
    longitude: z.number(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Ao menos um campo deve ser informado',
  })

/** Campos publicos de uma loja — usado tanto na criacao quanto na leitura publica. */
function toPublicStore(store: {
  id: string
  name: string
  slug: string
  description: string | null
  latitude: number
  longitude: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    description: store.description,
    latitude: store.latitude,
    longitude: store.longitude,
    isActive: store.isActive,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
  }
}

storeRoutes.post('/stores', requireUser, requireStoreOwner, async (c) => {
  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = createStoreSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const authedUser = c.get('authedUser')
  const { name, slug, description, latitude, longitude } = parsed.data

  const existing = await prisma.store.findUnique({ where: { slug } })
  if (existing) {
    return c.json({ error: 'Slug ja esta em uso' }, 409)
  }

  try {
    const store = await prisma.store.create({
      data: {
        ownerId: authedUser.id,
        name,
        slug,
        description,
        latitude,
        longitude,
      },
    })
    return c.json({ store: toPublicStore(store) }, 201)
  } catch {
    // Corrida entre o `findUnique` acima e o `create` (constraint unica de
    // `slug`) cai aqui como 409 generico.
    return c.json({ error: 'Slug ja esta em uso' }, 409)
  }
})

storeRoutes.get('/stores/:id', async (c) => {
  const id = c.req.param('id')
  const store = await prisma.store.findUnique({ where: { id } })
  if (!store || !store.isActive) {
    return c.json({ error: 'Loja nao encontrada' }, 404)
  }
  return c.json({ store: toPublicStore(store) })
})

storeRoutes.patch('/stores/:id', requireUser, requireStoreOwner, async (c) => {
  const id = c.req.param('id')
  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = updateStoreSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const store = await prisma.store.findUnique({ where: { id } })
  if (!store) {
    return c.json({ error: 'Loja nao encontrada' }, 404)
  }

  const authedUser = c.get('authedUser')
  // A distincao "papel STORE_OWNER" (garantida pelo middleware) vs "dono
  // DESTA loja" (dado) e checada aqui, na rota — ADMIN pode editar qualquer
  // loja, mas STORE_OWNER so a propria.
  if (authedUser.role !== 'ADMIN' && store.ownerId !== authedUser.id) {
    return c.json({ error: 'Voce nao tem permissao para editar esta loja' }, 403)
  }

  const { name, slug, description, latitude, longitude } = parsed.data

  if (slug && slug !== store.slug) {
    const existing = await prisma.store.findUnique({ where: { slug } })
    if (existing) {
      return c.json({ error: 'Slug ja esta em uso' }, 409)
    }
  }

  try {
    const updated = await prisma.store.update({
      where: { id },
      data: { name, slug, description, latitude, longitude },
    })
    return c.json({ store: toPublicStore(updated) })
  } catch {
    return c.json({ error: 'Slug ja esta em uso' }, 409)
  }
})
