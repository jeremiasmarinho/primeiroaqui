import { Hono, type Context } from 'hono'
import sharp from 'sharp'
import { prisma } from '../lib/prismaClient'
import { supabaseAdmin } from '../lib/supabaseClient'
import { requireUser, requireStoreOwner, type AuthEnv } from '../middleware/auth'
import {
  validateProductPhoto,
  buildStoragePath,
  buildThumbStoragePath,
  ensureProductPhotosBucket,
  StorageValidationError,
  PRODUCT_PHOTOS_BUCKET,
} from '../lib/productPhotoStorage'

export const productPhotoRoutes = new Hono<AuthEnv>()

const THUMB_WIDTH = 400

/**
 * Carrega o produto (com a loja, para checagem de posse) e valida que o
 * usuario autenticado e o dono da loja (ou ADMIN). Mesmo padrao de posse de
 * `products.ts`, reaproveitado aqui pois a posse de uma foto e a posse do
 * produto ao qual ela pertence.
 */
async function loadOwnedProduct(c: Context<AuthEnv>, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { store: true } })
  if (!product) {
    return { error: c.json({ error: 'Produto nao encontrado' }, 404) } as const
  }
  const authedUser = c.get('authedUser')
  const canOperate = authedUser.role === 'ADMIN' || authedUser.id === product.store.ownerId
  if (!canOperate) {
    return { error: c.json({ error: 'Voce nao tem permissao para alterar fotos deste produto' }, 403) } as const
  }
  return { product } as const
}

productPhotoRoutes.post('/products/:id/photos', requireUser, requireStoreOwner, async (c) => {
  const productId = c.req.param('id')
  if (!productId) {
    return c.json({ error: 'Produto nao encontrado' }, 404)
  }
  const owned = await loadOwnedProduct(c, productId)
  if ('error' in owned) return owned.error

  let body: Record<string, string | File>
  try {
    body = await c.req.parseBody()
  } catch {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const file = body['photo']
  if (!(file instanceof File)) {
    return c.json({ error: 'Campo "photo" (arquivo) e obrigatorio' }, 400)
  }

  try {
    validateProductPhoto({ size: file.size, type: file.type })
  } catch (error) {
    if (error instanceof StorageValidationError) {
      return c.json({ error: error.message }, 400)
    }
    throw error
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const thumbBuffer = await sharp(buffer).resize({ width: THUMB_WIDTH, withoutEnlargement: true }).toBuffer()

  await ensureProductPhotosBucket()

  const path = buildStoragePath(productId, file.type)
  const thumbPath = buildThumbStoragePath(path)

  const bucket = supabaseAdmin.storage.from(PRODUCT_PHOTOS_BUCKET)

  const { error: uploadError } = await bucket.upload(path, buffer, { contentType: file.type })
  if (uploadError) {
    return c.json({ error: `Falha ao enviar foto: ${uploadError.message}` }, 500)
  }
  const { error: thumbUploadError } = await bucket.upload(thumbPath, thumbBuffer, { contentType: file.type })
  if (thumbUploadError) {
    await bucket.remove([path])
    return c.json({ error: `Falha ao enviar thumbnail: ${thumbUploadError.message}` }, 500)
  }

  const { data: publicUrlData } = bucket.getPublicUrl(path)
  const { data: thumbPublicUrlData } = bucket.getPublicUrl(thumbPath)

  const position = await prisma.productPhoto.count({ where: { productId } })
  const photo = await prisma.productPhoto.create({
    data: {
      productId,
      url: publicUrlData.publicUrl,
      thumbUrl: thumbPublicUrlData.publicUrl,
      path,
      position,
    },
  })

  return c.json({ photo }, 201)
})

productPhotoRoutes.delete('/products/:id/photos/:photoId', requireUser, requireStoreOwner, async (c) => {
  const productId = c.req.param('id')
  const photoId = c.req.param('photoId')
  if (!productId || !photoId) {
    return c.json({ error: 'Foto nao encontrada' }, 404)
  }
  const owned = await loadOwnedProduct(c, productId)
  if ('error' in owned) return owned.error

  const photo = await prisma.productPhoto.findUnique({ where: { id: photoId } })
  if (!photo || photo.productId !== productId) {
    return c.json({ error: 'Foto nao encontrada' }, 404)
  }

  const thumbPath = buildThumbStoragePath(photo.path)
  await supabaseAdmin.storage.from(PRODUCT_PHOTOS_BUCKET).remove([photo.path, thumbPath])
  await prisma.productPhoto.delete({ where: { id: photoId } })

  return c.json({ ok: true }, 200)
})
