import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { supabasePublic } from '../lib/supabaseClient'
import { requireUser, type AuthEnv } from '../middleware/auth'
import { prisma } from '../lib/prismaClient'

export const mfaRoutes = new Hono<AuthEnv>()

/**
 * Ver comentário equivalente em auth.ts — corpo JSON malformado/ausente
 * responde 400 em vez de propagar excecao.
 */
async function parseJsonBody(c: Context<AuthEnv>): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return undefined
  }
}

function bearerToken(c: Context<AuthEnv>): string | undefined {
  return c.req.header('authorization')?.replace('Bearer ', '')
}

/**
 * `supabase.auth.mfa.*` (enroll/challenge/verify/unenroll/listFactors) opera
 * sobre a sessao ATUAL do cliente supabase-js, nao aceita so um access token
 * solto como parametro. Como o app usa um `supabasePublic` compartilhado
 * (mesmo cliente do resto de auth.ts — ver `reset-password`, que ja faz
 * `setSession` do mesmo jeito), fixamos a sessao da requisicao corrente antes
 * de cada chamada MFA.
 *
 * NOTA (mesmo debito ja aceito em auth.ts/reset-password): `supabasePublic` e
 * um singleton por processo — duas requisicoes concorrentes chamando rotas
 * MFA poderiam, em teoria, disputar qual sessao fica setada entre o
 * `setSession` e a chamada seguinte. Nao é diferente do risco ja existente no
 * reset-password; fora de escopo desta fase trocar por um cliente por
 * requisicao (exigiria refatorar auth.ts inteiro).
 */
async function withUserSession<T>(c: Context<AuthEnv>, run: () => Promise<T>): Promise<T | null> {
  const token = bearerToken(c)
  if (!token) return null
  // refresh_token nao importa aqui: nenhuma chamada MFA desta rota aciona
  // refresh automatico dentro da mesma requisicao (autoRefreshToken usa timer,
  // nao dispara de forma sincrona durante estas chamadas).
  await supabasePublic.auth.setSession({ access_token: token, refresh_token: token })
  return run()
}

mfaRoutes.post('/mfa/enroll', requireUser, async (c) => {
  const result = await withUserSession(c, () => supabasePublic.auth.mfa.enroll({ factorType: 'totp' }))
  if (!result || result.error || !result.data) {
    return c.json({ error: 'Nao foi possivel iniciar a verificacao em duas etapas' }, 400)
  }
  const { id, totp } = result.data
  return c.json({
    factorId: id,
    qrCode: totp.qr_code,
    secret: totp.secret,
  })
})

const verifySchema = z.object({
  factorId: z.string().min(1, 'factorId obrigatorio'),
  code: z.string().length(6, 'Codigo deve ter 6 digitos'),
})

/** Confirma o enrollment: primeiro código digitado após escanear o QR. */
mfaRoutes.post('/mfa/verify', requireUser, async (c) => {
  const body = await parseJsonBody(c)
  if (body === undefined) return c.json({ error: 'Body invalido ou ausente' }, 400)
  const parsed = verifySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const result = await withUserSession(c, () =>
    supabasePublic.auth.mfa.challengeAndVerify({
      factorId: parsed.data.factorId,
      code: parsed.data.code,
    }),
  )
  if (!result || result.error) {
    return c.json({ error: 'Codigo invalido ou expirado' }, 400)
  }

  return c.json({ ok: true })
})

const challengeSchema = z.object({
  factorId: z.string().min(1, 'factorId obrigatorio'),
})

/** Usado no LOGIN (após senha correta, quando o usuário tem TOTP ativo) e ao desativar/testar o fator. */
mfaRoutes.post('/mfa/challenge', requireUser, async (c) => {
  const body = await parseJsonBody(c)
  if (body === undefined) return c.json({ error: 'Body invalido ou ausente' }, 400)
  const parsed = challengeSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const result = await withUserSession(c, () =>
    supabasePublic.auth.mfa.challenge({ factorId: parsed.data.factorId }),
  )
  if (!result || result.error || !result.data) {
    return c.json({ error: 'Nao foi possivel iniciar o desafio de verificacao' }, 400)
  }

  return c.json({ challengeId: result.data.id })
})

const verifyChallengeSchema = z.object({
  factorId: z.string().min(1, 'factorId obrigatorio'),
  challengeId: z.string().min(1, 'challengeId obrigatorio'),
  code: z.string().length(6, 'Codigo deve ter 6 digitos'),
})

/**
 * Conclui o desafio de LOGIN: verifica o código de 6 dígitos e, se válido,
 * devolve o mesmo shape de POST /auth/login (sessão final em aal2 + user do
 * Prisma) — o front trata a resposta exatamente como um login normal.
 */
mfaRoutes.post('/mfa/verify-challenge', requireUser, async (c) => {
  const body = await parseJsonBody(c)
  if (body === undefined) return c.json({ error: 'Body invalido ou ausente' }, 400)
  const parsed = verifyChallengeSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const result = await withUserSession(c, () =>
    supabasePublic.auth.mfa.verify({
      factorId: parsed.data.factorId,
      challengeId: parsed.data.challengeId,
      code: parsed.data.code,
    }),
  )
  if (!result || result.error || !result.data) {
    return c.json({ error: 'Codigo invalido ou expirado' }, 401)
  }

  const authedUser = c.get('authedUser')
  const user = await prisma.user.findUnique({ where: { id: authedUser.id } })
  if (!user) {
    return c.json({ error: 'Nao foi possivel concluir o login' }, 401)
  }

  return c.json({
    session: {
      accessToken: result.data.access_token,
      refreshToken: result.data.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + result.data.expires_in,
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

mfaRoutes.delete('/mfa/:factorId', requireUser, async (c) => {
  const factorId = c.req.param('factorId')!
  const result = await withUserSession(c, () => supabasePublic.auth.mfa.unenroll({ factorId }))
  if (!result || result.error) {
    return c.json({ error: 'Nao foi possivel desativar a verificacao em duas etapas' }, 400)
  }
  return c.json({ ok: true })
})

mfaRoutes.get('/mfa/factors', requireUser, async (c) => {
  const result = await withUserSession(c, () => supabasePublic.auth.mfa.listFactors())
  if (!result || result.error || !result.data) {
    return c.json({ error: 'Nao foi possivel listar os fatores de verificacao' }, 400)
  }
  return c.json({
    factors: result.data.totp.map((factor) => ({
      id: factor.id,
      status: factor.status,
      createdAt: factor.created_at,
    })),
  })
})
