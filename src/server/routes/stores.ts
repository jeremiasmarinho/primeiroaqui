import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { prisma } from '../lib/prismaClient'
import { supabaseAdmin } from '../lib/supabaseClient'
import { requireUser, requireStoreOwner, type AuthEnv } from '../middleware/auth'
import {
  validateStoreLogo,
  buildStoreLogoStoragePath,
  processStoreLogoImage,
  ensureStoreLogosBucket,
  StorageValidationError,
  STORE_LOGOS_BUCKET,
} from '../lib/storeLogoStorage'

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

const storeCategorySchema = z.enum([
  'MERCADO',
  'PADARIA',
  'FARMACIA',
  'PETSHOP',
  'HORTIFRUTI',
  'RESTAURANTE',
  'SERVICOS',
  'OUTROS',
])

const createStoreSchema = z.object({
  name: z.string().trim().min(1, 'Nome nao pode ser vazio'),
  slug: slugSchema,
  description: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  category: storeCategorySchema.optional(),
  giftWrapAvailable: z.boolean().optional(),
})

const updateStoreSchema = z
  .object({
    name: z.string().trim().min(1, 'Nome nao pode ser vazio'),
    slug: slugSchema,
    description: z.string().optional(),
    latitude: z.number(),
    longitude: z.number(),
    category: storeCategorySchema,
    giftWrapAvailable: z.boolean(),
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
  category: string
  logoUrl: string | null
  isActive: boolean
  giftWrapAvailable: boolean
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
    category: store.category,
    logoUrl: store.logoUrl,
    isActive: store.isActive,
    giftWrapAvailable: store.giftWrapAvailable,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
  }
}

/**
 * Deriva o path de storage a partir de uma URL publica do bucket
 * `store-logos` (`.../storage/v1/object/public/store-logos/<path>`), para
 * poder remover o arquivo anterior antes de subir o novo. Mesmo padrao de
 * `storagePathFromPublicUrl` em routes/me.ts.
 */
const storagePathFromPublicUrl = (url: string): string | null => {
  const marker = `/${STORE_LOGOS_BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return null
  return url.slice(index + marker.length)
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
  const { name, slug, description, latitude, longitude, category, giftWrapAvailable } = parsed.data

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
        ...(category !== undefined ? { category } : {}),
        ...(giftWrapAvailable !== undefined ? { giftWrapAvailable } : {}),
      },
    })
    return c.json({ store: toPublicStore(store) }, 201)
  } catch {
    // Corrida entre o `findUnique` acima e o `create` (constraint unica de
    // `slug`) cai aqui como 409 generico.
    return c.json({ error: 'Slug ja esta em uso' }, 409)
  }
})

const listStoresQuerySchema = z.object({
  category: storeCategorySchema.optional(),
})

/** Listagem publica de lojas ativas — usada na rail "Lojas da cidade" da home. */
storeRoutes.get('/stores', async (c) => {
  const parsed = listStoresQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: 'Parametros invalidos', details: parsed.error.flatten() }, 400)
  }
  const { category } = parsed.data

  const stores = await prisma.store.findMany({
    where: {
      isActive: true,
      ...(category !== undefined ? { category } : {}),
    },
    orderBy: { name: 'asc' },
  })
  return c.json({
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
      slug: store.slug,
      description: store.description,
      category: store.category,
      logoUrl: store.logoUrl,
      giftWrapAvailable: store.giftWrapAvailable,
    })),
  })
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

  const { name, slug, description, latitude, longitude, category, giftWrapAvailable } = parsed.data

  if (slug && slug !== store.slug) {
    const existing = await prisma.store.findUnique({ where: { slug } })
    if (existing) {
      return c.json({ error: 'Slug ja esta em uso' }, 409)
    }
  }

  try {
    const updated = await prisma.store.update({
      where: { id },
      data: { name, slug, description, latitude, longitude, category, giftWrapAvailable },
    })
    return c.json({ store: toPublicStore(updated) })
  } catch {
    return c.json({ error: 'Slug ja esta em uso' }, 409)
  }
})

/**
 * Upload do logo da loja: dono da loja OU ADMIN. `requireStoreOwner` so
 * garante o papel — a checagem de dono DESTA loja e feita aqui, mesmo padrao
 * do PATCH /stores/:id acima.
 */
storeRoutes.post('/me/stores/:id/logo', requireUser, requireStoreOwner, async (c) => {
  const id = c.req.param('id')
  const authedUser = c.get('authedUser')

  const store = await prisma.store.findUnique({ where: { id } })
  if (!store) {
    return c.json({ error: 'Loja nao encontrada' }, 404)
  }
  if (authedUser.role !== 'ADMIN' && store.ownerId !== authedUser.id) {
    return c.json({ error: 'Voce nao tem permissao para editar esta loja' }, 403)
  }

  let body: Record<string, string | File>
  try {
    body = await c.req.parseBody()
  } catch {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const file = body['file']
  if (!(file instanceof File)) {
    return c.json({ error: 'Campo "file" (arquivo) e obrigatorio' }, 400)
  }

  try {
    validateStoreLogo({ size: file.size, type: file.type })
  } catch (error) {
    if (error instanceof StorageValidationError) {
      return c.json({ error: error.message }, 400)
    }
    throw error
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let processedBuffer: Buffer
  try {
    processedBuffer = await processStoreLogoImage(buffer)
  } catch (error) {
    if (error instanceof StorageValidationError) {
      return c.json({ error: error.message }, 400)
    }
    throw error
  }

  await ensureStoreLogosBucket()

  const path = buildStoreLogoStoragePath(store.id)
  const bucket = supabaseAdmin.storage.from(STORE_LOGOS_BUCKET)

  const { error: uploadError } = await bucket.upload(path, processedBuffer, { contentType: 'image/jpeg' })
  if (uploadError) {
    return c.json({ error: `Falha ao enviar logo: ${uploadError.message}` }, 500)
  }

  const { data: publicUrlData } = bucket.getPublicUrl(path)

  let updated
  try {
    updated = await prisma.store.update({
      where: { id: store.id },
      data: { logoUrl: publicUrlData.publicUrl },
    })
  } catch (error) {
    await bucket.remove([path])
    console.error('Falha ao atualizar logoUrl da loja:', error)
    return c.json({ error: 'Falha ao salvar logo da loja' }, 500)
  }

  // Remove o logo anterior so depois do novo estar salvo com sucesso — mesmo
  // padrao de POST /me/avatar.
  const previousPath = store.logoUrl ? storagePathFromPublicUrl(store.logoUrl) : null
  if (previousPath) {
    const { error: removeError } = await bucket.remove([previousPath])
    if (removeError) {
      console.error(`Falha ao remover logo anterior (path=${previousPath}): ${removeError.message}`)
    }
  }

  return c.json({ store: toPublicStore(updated) })
})

/** Remove o logo da loja: dono da loja OU ADMIN. */
storeRoutes.delete('/me/stores/:id/logo', requireUser, requireStoreOwner, async (c) => {
  const id = c.req.param('id')
  const authedUser = c.get('authedUser')

  const store = await prisma.store.findUnique({ where: { id } })
  if (!store) {
    return c.json({ error: 'Loja nao encontrada' }, 404)
  }
  if (authedUser.role !== 'ADMIN' && store.ownerId !== authedUser.id) {
    return c.json({ error: 'Voce nao tem permissao para editar esta loja' }, 403)
  }

  const path = store.logoUrl ? storagePathFromPublicUrl(store.logoUrl) : null
  if (path) {
    const { error: removeError } = await supabaseAdmin.storage.from(STORE_LOGOS_BUCKET).remove([path])
    if (removeError) {
      return c.json(
        { error: `Falha ao remover logo do storage, registro mantido para nova tentativa: ${removeError.message}` },
        500,
      )
    }
  }

  const updated = await prisma.store.update({
    where: { id: store.id },
    data: { logoUrl: null },
  })

  return c.json({ store: toPublicStore(updated) })
})
