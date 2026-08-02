import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { supabasePublic, supabaseAdmin } from '../lib/supabaseClient'
import { prisma } from '../lib/prismaClient'
import { requireUser, type AuthEnv } from '../middleware/auth'

export const authRoutes = new Hono<AuthEnv>()

/**
 * Faz parse do corpo JSON da requisicao sem lancar excecao. Corpo malformado
 * (JSON invalido) ou ausente retorna `undefined` em vez de propagar o erro do
 * Hono/`Request.json()`, permitindo que o chamador responda 400 em vez de um
 * 500 nao tratado — importante em rotas publicas (signup/login), acessiveis
 * por qualquer anonimo.
 */
async function parseJsonBody(c: Context<AuthEnv>): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return undefined
  }
}

const signupSchema = z.object({
  email: z.string().email('E-mail invalido'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  name: z.string().trim().min(1, 'Nome nao pode ser vazio'),
})

const loginSchema = z.object({
  email: z.string().email('E-mail invalido'),
  password: z.string().min(1, 'Senha obrigatoria'),
})

/**
 * Mensagem de erro generica para falhas de autenticacao — nunca revela se o
 * e-mail existe ou nao (evita enumeracao de contas).
 */
const GENERIC_AUTH_ERROR = 'E-mail ou senha invalidos'

authRoutes.post('/auth/signup', async (c) => {
  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = signupSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }
  const { email, password, name } = parsed.data

  const { data, error } = await supabasePublic.auth.signUp({ email, password })
  if (error) {
    // 429 do Supabase Auth e limite de envio de e-mail (infra), nao um
    // conflito de dominio — repassar como 429 em vez de mascarar como 409.
    if (error.status === 429) {
      return c.json({ error: 'Limite de criacao de contas atingido, tente novamente mais tarde' }, 429)
    }
    return c.json({ error: 'Nao foi possivel criar o usuario' }, 409)
  }

  // Supabase pode responder sem erro para e-mail ja cadastrado (protecao
  // contra enumeracao de contas): o usuario retornado tem `identities` vazio.
  if (!data.user || data.user.identities?.length === 0) {
    return c.json({ error: 'Nao foi possivel criar o usuario' }, 409)
  }

  try {
    // `role` nunca vem do body — sempre BUYER na criacao, para nao permitir
    // escalação de privilegio via signup.
    const user = await prisma.user.create({
      data: {
        authUserId: data.user.id,
        email,
        name,
        role: 'BUYER',
      },
    })

    return c.json(
      {
        user: {
          id: user.id,
          authUserId: user.authUserId,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      201,
    )
  } catch {
    // NOTA: qualquer erro aqui (constraint unica de `email`/`authUserId`, ou
    // uma falha de conexao com o Postgres) cai neste mesmo 409 generico, e o
    // usuario ja foi criado no Supabase Auth — fica orfao (sem `User` no
    // Prisma) se a causa nao for duplicidade. Fora de escopo desta fase
    // reconciliar isso (ex.: `supabaseAdmin.auth.admin.deleteUser` em caso de
    // erro que nao seja de unicidade); registrado como debito conhecido.
    return c.json({ error: 'Nao foi possivel criar o usuario' }, 409)
  }
})

authRoutes.post('/auth/login', async (c) => {
  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }
  const { email, password } = parsed.data

  const { data, error } = await supabasePublic.auth.signInWithPassword({ email, password })
  if (error || !data.session || !data.user) {
    return c.json({ error: GENERIC_AUTH_ERROR }, 401)
  }

  const user = await prisma.user.findUnique({ where: { authUserId: data.user.id } })
  if (!user) {
    return c.json({ error: GENERIC_AUTH_ERROR }, 401)
  }

  return c.json({
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    },
    user: {
      id: user.id,
      authUserId: user.authUserId,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  })
})

authRoutes.post('/auth/logout', async (c) => {
  const token = c.req.header('authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Nao autenticado' }, 401)

  // Servidor e stateless (nao guarda sessao do usuario no cliente Supabase),
  // entao invalidar o token recebido exige a API admin (service role) — o
  // equivalente server-side de `auth.signOut()` para um token que nao esta
  // no cliente atual.
  const { error } = await supabaseAdmin.auth.admin.signOut(token, 'global')
  if (error) {
    return c.json({ error: 'Token invalido' }, 401)
  }

  return c.json({ ok: true })
})

authRoutes.get('/me', requireUser, (c) => {
  return c.json({ user: c.get('authedUser') })
})
