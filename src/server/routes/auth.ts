import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { supabasePublic, supabaseAdmin, supabaseUrl } from '../lib/supabaseClient'
import { prisma } from '../lib/prismaClient'
import { requireUser, type AuthEnv } from '../middleware/auth'
import type { User } from '@prisma/client'

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

  // Usuario com fator TOTP ativo (verified): a sessao emitida pelo
  // signInWithPassword ainda esta em aal1 — o login so termina depois de
  // POST /mfa/challenge + POST /mfa/verify-challenge com essa mesma sessao
  // (ver mfa.ts). O front nao recebe a sessao final aqui, so o suficiente
  // para completar o desafio.
  const { data: factorsData } = await supabasePublic.auth.mfa.listFactors()
  const totpFactor = factorsData?.totp?.find((factor) => factor.status === 'verified')
  if (totpFactor) {
    return c.json({
      mfaRequired: true,
      factorId: totpFactor.id,
      tempSession: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
    })
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
      avatarUrl: user.avatarUrl,
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

const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail invalido'),
})

/**
 * Sempre responde 200 com o mesmo corpo, exista ou nao o e-mail — igual ao
 * login, para nao permitir enumeracao de contas. Erros do Supabase (rate
 * limit, etc.) tambem nao vazam para a resposta.
 */
/**
 * Origem real do navegador para montar links de retorno (reset de senha,
 * callback OAuth). Fetch GET same-origin nao envia o header Origin — no dev
 * (Vite :5173 proxiando a API em :3333) o fallback pela URL do request
 * apontaria para a porta errada; o Referer preserva a origem verdadeira.
 */
function requestOrigin(c: { req: { header: (name: string) => string | undefined; url: string } }) {
  const referer = c.req.header('referer')
  return c.req.header('origin') ?? (referer ? new URL(referer).origin : new URL(c.req.url).origin)
}

authRoutes.post('/auth/forgot-password', async (c) => {
  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = forgotPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const origin = requestOrigin(c)
  try {
    await supabasePublic.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/redefinir-senha`,
    })
  } catch {
    // Falha de infra (rede com o Supabase) nao pode vazar para a resposta —
    // o cliente sempre ve a mesma mensagem generica de sucesso.
  }

  return c.json({ ok: true })
})

const resetPasswordSchema = z.object({
  accessToken: z.string().min(1, 'Token de redefinicao ausente'),
  refreshToken: z.string().min(1, 'Token de redefinicao ausente'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
})

/**
 * Usa o par de tokens do link de recuperacao (enviado por e-mail pelo
 * Supabase) para autenticar a troca de senha: `setSession` valida o token de
 * recovery, `updateUser` grava a nova senha nessa sessao.
 */
authRoutes.post('/auth/reset-password', async (c) => {
  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }
  const { accessToken, refreshToken, password } = parsed.data

  const { error: sessionError } = await supabasePublic.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  if (sessionError) {
    return c.json({ error: 'Link de redefinicao invalido ou expirado' }, 401)
  }

  const { error: updateError } = await supabasePublic.auth.updateUser({ password })
  if (updateError) {
    return c.json({ error: 'Nao foi possivel redefinir a senha' }, 400)
  }

  return c.json({ ok: true })
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token ausente'),
})

authRoutes.post('/auth/refresh', async (c) => {
  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = refreshSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const { data, error } = await supabasePublic.auth.refreshSession({
    refresh_token: parsed.data.refreshToken,
  })
  if (error || !data.session) {
    return c.json({ error: 'Sessao expirada, faca login novamente' }, 401)
  }

  return c.json({
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    },
  })
})

/** Providers OAuth aceitos — allowlist explicita evita repassar provider arbitrario ao Supabase. */
const OAUTH_PROVIDERS = ['google'] as const

/**
 * Monta a URL de `/auth/v1/authorize` do Supabase no servidor: o front nao
 * tem `SUPABASE_URL` disponivel (nunca usou supabase-js no cliente), entao
 * este endpoint devolve a URL ja pronta. `redirect` e o caminho para onde a
 * pessoa deve voltar apos o login (ex.: a tela que exigiu login) — validado
 * para comecar com `/`, nunca uma URL absoluta (evita open redirect).
 */
authRoutes.get('/auth/oauth-url', (c) => {
  const provider = c.req.query('provider')
  const redirect = c.req.query('redirect') ?? '/'

  if (!provider || !OAUTH_PROVIDERS.includes(provider as (typeof OAUTH_PROVIDERS)[number])) {
    return c.json({ error: 'Provedor OAuth invalido' }, 400)
  }
  if (!redirect.startsWith('/')) {
    return c.json({ error: 'Redirecionamento invalido' }, 400)
  }

  const origin = requestOrigin(c)
  const redirectTo = `${origin}/entrar/callback?redirect=${encodeURIComponent(redirect)}`
  const url = `${supabaseUrl}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}`

  return c.json({ url })
})

/**
 * Cria (primeiro login social) ou atualiza o `User` do Prisma a partir de um
 * usuario ja autenticado no Supabase. Extraida da rota para ser testavel sem
 * subir o Hono inteiro (ver auth.unit.test.ts) — cobre a regra de
 * anti-escalacao (role sempre BUYER na criacao) e o preenchimento de
 * nome/avatar só quando ainda vazios num usuario existente.
 */
export async function upsertOAuthUser(authUser: {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}): Promise<User> {
  const metadata = authUser.user_metadata ?? {}
  const email = authUser.email ?? ''
  const name =
    (metadata.full_name as string | undefined) ?? (metadata.name as string | undefined) ?? email
  const avatarUrl =
    (metadata.avatar_url as string | undefined) ?? (metadata.picture as string | undefined) ?? null

  const existing = await prisma.user.findUnique({ where: { authUserId: authUser.id } })
  if (existing) {
    const patch: { name?: string; avatarUrl?: string } = {}
    if (!existing.name && name) patch.name = name
    if (!existing.avatarUrl && avatarUrl) patch.avatarUrl = avatarUrl
    if (Object.keys(patch).length === 0) return existing
    return prisma.user.update({ where: { id: existing.id }, data: patch })
  }

  // `role` nunca vem do token do Supabase — sempre BUYER na criacao, mesma
  // anti-escalacao do /auth/signup.
  return prisma.user.create({
    data: { authUserId: authUser.id, email, name, avatarUrl, role: 'BUYER' },
  })
}

const oauthCompleteSchema = z.object({
  accessToken: z.string().min(1, 'Token de acesso ausente'),
  refreshToken: z.string().min(1, 'Refresh token ausente'),
  /** Epoch em segundos — vem do fragmento da URL do redirect do Supabase, apenas ecoado de volta. */
  expiresAt: z.number().optional(),
})

/**
 * Conclui o login social: valida o `accessToken` recebido do redirect OAuth
 * direto no Supabase (`supabaseAdmin.auth.getUser`) e faz upsert do usuario.
 * Devolve o mesmo shape de POST /auth/login.
 */
authRoutes.post('/auth/oauth-complete', async (c) => {
  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = oauthCompleteSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }
  const { accessToken, refreshToken, expiresAt } = parsed.data

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
  if (error || !data.user) {
    return c.json({ error: 'Sessao OAuth invalida ou expirada' }, 401)
  }

  const user = await upsertOAuthUser(data.user)

  return c.json({
    session: { accessToken, refreshToken, expiresAt },
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
