import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { prisma } from '../lib/prismaClient'
import { supabaseAdmin } from '../lib/supabaseClient'
import { requireUser, type AuthEnv } from '../middleware/auth'
import {
  validateAvatarPhoto,
  buildAvatarStoragePath,
  processAvatarImage,
  ensureAvatarsBucket,
  StorageValidationError,
  AVATARS_BUCKET,
} from '../lib/avatarStorage'
// Reaproveita a validação de CPF/telefone já usada no formulário de
// pagamento (`src/lib/paymentValidation.ts`) em vez de duplicar o algoritmo
// de dígitos verificadores no servidor — mesmo arquivo, sem dependência de
// browser, importável direto pelo Node (ver CLAUDE.md, "reuso antes de
// reconstruir").
import { isValidCpf, isValidPhone } from '../../lib/paymentValidation'

/**
 * Rotas de `/api/me/avatar` e `/api/me` — arquivo separado (nao
 * `routes/auth.ts`) para evitar conflito com outro agente que adiciona
 * rotas novas naquele mesmo arquivo em paralelo.
 */
export const meRoutes = new Hono<AuthEnv>()

/** Mesmo padrao de `parseJsonBody` em `src/server/routes/addresses.ts`. */
async function parseJsonBody(c: Context<AuthEnv>): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return undefined
  }
}

const updateMeSchema = z.object({
  name: z.string().trim().min(1, 'Nome nao pode ser vazio').optional(),
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || isValidPhone(value), 'Telefone invalido')
    .optional(),
  document: z
    .string()
    .trim()
    .refine((value) => value === '' || isValidCpf(value), 'CPF invalido')
    .optional(),
})

/**
 * Atualiza dados do proprio perfil (nome, telefone, CPF). Distinto de
 * `/me/avatar` (upload de arquivo) — aqui e so JSON. `phone`/`document`
 * vazios (`''`) limpam o campo (viram `null` no banco); `undefined` mantem o
 * valor atual (PATCH parcial).
 */
meRoutes.patch('/me', requireUser, async (c) => {
  const authedUser = c.get('authedUser')

  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = updateMeSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const { name, phone, document } = parsed.data
  const data: { name?: string; phone?: string | null; document?: string | null } = {}
  if (name !== undefined) data.name = name
  if (phone !== undefined) data.phone = phone === '' ? null : phone
  if (document !== undefined) data.document = document === '' ? null : document

  const user = await prisma.user.update({
    where: { id: authedUser.id },
    data,
  })

  return c.json({
    user: {
      id: user.id,
      authUserId: user.authUserId,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      document: user.document,
    },
  })
})

/**
 * Deriva o path de storage a partir de uma URL publica do bucket `avatars`
 * (`.../storage/v1/object/public/avatars/<path>`), para poder remover o
 * arquivo anterior antes de subir o novo.
 */
const storagePathFromPublicUrl = (url: string): string | null => {
  const marker = `/${AVATARS_BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return null
  return url.slice(index + marker.length)
}

meRoutes.post('/me/avatar', requireUser, async (c) => {
  const authedUser = c.get('authedUser')

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
    validateAvatarPhoto({ size: file.size, type: file.type })
  } catch (error) {
    if (error instanceof StorageValidationError) {
      return c.json({ error: error.message }, 400)
    }
    throw error
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let processedBuffer: Buffer
  try {
    processedBuffer = await processAvatarImage(buffer)
  } catch (error) {
    if (error instanceof StorageValidationError) {
      return c.json({ error: error.message }, 400)
    }
    throw error
  }

  await ensureAvatarsBucket()

  const previous = await prisma.user.findUnique({ where: { id: authedUser.id }, select: { avatarUrl: true } })
  const path = buildAvatarStoragePath(authedUser.id)
  const bucket = supabaseAdmin.storage.from(AVATARS_BUCKET)

  const { error: uploadError } = await bucket.upload(path, processedBuffer, { contentType: 'image/jpeg' })
  if (uploadError) {
    return c.json({ error: `Falha ao enviar foto: ${uploadError.message}` }, 500)
  }

  const { data: publicUrlData } = bucket.getPublicUrl(path)

  let user
  try {
    user = await prisma.user.update({
      where: { id: authedUser.id },
      data: { avatarUrl: publicUrlData.publicUrl },
    })
  } catch (error) {
    await bucket.remove([path])
    console.error('Falha ao atualizar avatarUrl do usuario:', error)
    return c.json({ error: 'Falha ao salvar foto de perfil' }, 500)
  }

  // Remove o avatar anterior do storage so depois do novo estar salvo com
  // sucesso — se a remocao falhar, o arquivo orfao fica para limpeza manual,
  // mas o usuario ja tem o avatar novo funcionando.
  const previousPath = previous?.avatarUrl ? storagePathFromPublicUrl(previous.avatarUrl) : null
  if (previousPath) {
    const { error: removeError } = await bucket.remove([previousPath])
    if (removeError) {
      console.error(`Falha ao remover avatar anterior (path=${previousPath}): ${removeError.message}`)
    }
  }

  return c.json({
    user: {
      id: user.id,
      authUserId: user.authUserId,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
  })
})

meRoutes.delete('/me/avatar', requireUser, async (c) => {
  const authedUser = c.get('authedUser')

  const current = await prisma.user.findUnique({ where: { id: authedUser.id }, select: { avatarUrl: true } })
  const path = current?.avatarUrl ? storagePathFromPublicUrl(current.avatarUrl) : null

  if (path) {
    const { error: removeError } = await supabaseAdmin.storage.from(AVATARS_BUCKET).remove([path])
    if (removeError) {
      return c.json(
        { error: `Falha ao remover foto do storage, registro mantido para nova tentativa: ${removeError.message}` },
        500,
      )
    }
  }

  const user = await prisma.user.update({
    where: { id: authedUser.id },
    data: { avatarUrl: null },
  })

  return c.json({
    user: {
      id: user.id,
      authUserId: user.authUserId,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
  })
})
