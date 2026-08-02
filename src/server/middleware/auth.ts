import type { Context, Next } from 'hono'
import { supabasePublic } from '../lib/supabaseClient'
import { prisma } from '../lib/prismaClient'

/** Papel do usuario autenticado, resolvido a partir do registro `User` no Prisma. Anexado ao contexto Hono via `c.set`. */
export type AuthedUser = {
  id: string
  authUserId: string
  email: string
  role: 'BUYER' | 'STORE_OWNER' | 'ADMIN'
}

/** Variaveis de contexto Hono usadas pelas rotas autenticadas — usar como `Hono<AuthEnv>`. */
export type AuthEnv = { Variables: { authedUser: AuthedUser } }

const CONTEXT_KEY = 'authedUser'

/** Exige token Bearer valido do Supabase Auth. Anexa o User correspondente (do Prisma) ao contexto Hono sob a chave `authedUser`. 401 se ausente/invalido. */
export const requireUser = async (c: Context, next: Next) => {
  const token = c.req.header('authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Nao autenticado' }, 401)

  const { data, error } = await supabasePublic.auth.getUser(token)
  if (error || !data.user) return c.json({ error: 'Token invalido' }, 401)

  const user = await prisma.user.findUnique({ where: { authUserId: data.user.id } })
  if (!user) return c.json({ error: 'Usuario nao encontrado' }, 401)

  c.set(CONTEXT_KEY, {
    id: user.id,
    authUserId: user.authUserId,
    email: user.email,
    role: user.role,
  } satisfies AuthedUser)
  await next()
}

/** Exige que `requireUser` ja tenha rodado antes (encadear como `requireUser, requireStoreOwner`). 403 se o papel nao for STORE_OWNER nem ADMIN. */
export const requireStoreOwner = async (c: Context, next: Next) => {
  const authedUser = c.get(CONTEXT_KEY) as AuthedUser | undefined
  if (!authedUser || (authedUser.role !== 'STORE_OWNER' && authedUser.role !== 'ADMIN')) {
    return c.json({ error: 'Acesso restrito a donos de loja' }, 403)
  }
  await next()
}

/** Exige que `requireUser` ja tenha rodado antes. 403 se o papel nao for ADMIN. */
export const requireAdmin = async (c: Context, next: Next) => {
  const authedUser = c.get(CONTEXT_KEY) as AuthedUser | undefined
  if (!authedUser || authedUser.role !== 'ADMIN') {
    return c.json({ error: 'Acesso restrito a administradores' }, 403)
  }
  await next()
}
