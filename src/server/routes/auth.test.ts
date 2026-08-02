import { afterAll, describe, expect, it } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

/**
 * Testes de integracao contra o Supabase/Postgres reais do projeto (sem
 * ambiente de teste separado neste MVP).
 *
 * `/auth/signup` dispara e-mail de confirmacao real via
 * `supabasePublic.auth.signUp` — o projeto Supabase e free tier com um
 * limite baixo de envio de e-mail (poucos por hora). Por isso os testes
 * abaixo chamam o endpoint real de signup o mínimo necessário (2 vezes:
 * sucesso + duplicado); os demais fixtures usam `createFixtureUser`
 * (API admin, sem e-mail) para não esbarrar no limite.
 */
describe('POST /auth/signup', () => {
  const createdAuthUserIds: string[] = []

  afterAll(async () => {
    await Promise.all(createdAuthUserIds.map((id) => deleteFixtureUser(id)))
  })

  it('cria usuario com role BUYER mesmo se o body tentar mandar role ADMIN', async (ctx) => {
    // `@example.com`/`@example.org` sao dominios reservados (RFC 2606) que o
    // signUp *publico* do GoTrue rejeita como invalidos (diferente da API
    // admin usada pelos fixtures, que aceita); por isso usamos `@teste.com`
    // aqui, mesma convencao ja usada em `src/test/factories.ts`.
    const email = `teste-fase4-signup-${Date.now()}-${Math.random().toString(36).slice(2)}@teste.com`

    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'senha-teste-123',
        name: 'Usuario Teste',
        role: 'ADMIN',
      }),
    })

    // O Supabase Auth deste projeto (free tier) tem um limite baixo de
    // envio de e-mail por hora, compartilhado entre todos os testes que
    // chamam /auth/signup de verdade. Sob rate limit nao ha o que validar
    // aqui — pular em vez de falhar localmente (nao e um bug do codigo).
    // Em CI, porem, esse rate limit e efetivamente permanente (nao "reseta
    // em breve") e um skip silencioso mascararia a suite quebrada
    // indefinidamente — falhar explicitamente para forcar a resolucao
    // (SMTP customizado ou desabilitar "Confirm email" no dashboard do
    // Supabase) antes de confiar nesta suite em CI.
    if (res.status === 429) {
      if (process.env.CI) {
        throw new Error(
          'Rate limit de e-mail do Supabase atingido em CI — resolva no dashboard do Supabase ' +
            '(SMTP customizado ou desabilitar "Confirm email") antes de rodar este teste em CI.',
        )
      }
      return ctx.skip()
    }

    expect(res.status).toBe(201)
    const body = (await res.json()) as { user: { authUserId: string; role: string; email: string } }
    expect(body.user.role).toBe('BUYER')
    expect(body.user.email).toBe(email)
    createdAuthUserIds.push(body.user.authUserId)

    const dbUser = await prisma.user.findUnique({ where: { authUserId: body.user.authUserId } })
    expect(dbUser?.role).toBe('BUYER')
  }, 20_000)

  it('falha com e-mail invalido antes de tocar no Supabase (400)', async () => {
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nao-e-email', password: 'senha-teste-123', name: 'X' }),
    })
    expect(res.status).toBe(400)
  })

  it('falha com senha curta antes de tocar no Supabase (400)', async () => {
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'valido@example.com', password: '123', name: 'X' }),
    })
    expect(res.status).toBe(400)
  })

  it('body JSON malformado retorna 400 (nunca 500)', async () => {
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'isso-nao-e-json{{{',
    })
    expect(res.status).toBe(400)
  })

  it('sem body retorna 400 (nunca 500)', async () => {
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })

  it('signup com e-mail duplicado falha', async (ctx) => {
    const email = `teste-fase4-signup-dup-${Date.now()}-${Math.random().toString(36).slice(2)}@teste.com`

    const first = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'senha-teste-123', name: 'Primeiro' }),
    })
    if (first.status === 429) {
      if (process.env.CI) {
        throw new Error(
          'Rate limit de e-mail do Supabase atingido em CI — resolva no dashboard do Supabase ' +
            '(SMTP customizado ou desabilitar "Confirm email") antes de rodar este teste em CI.',
        )
      }
      return ctx.skip()
    }
    expect(first.status).toBe(201)
    const firstBody = (await first.json()) as { user: { authUserId: string } }
    createdAuthUserIds.push(firstBody.user.authUserId)

    const second = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'outra-senha-123', name: 'Segundo' }),
    })
    expect(second.status).toBe(409)
  }, 20_000)
})

describe('POST /auth/login', () => {
  it('login com senha errada retorna 401 sem detalhar o motivo', async () => {
    const fixture = await createFixtureUser('BUYER')
    try {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: fixture.email, password: 'senha-errada' }),
      })
      expect(res.status).toBe(401)
      const body = (await res.json()) as { error: string }
      expect(body.error).not.toMatch(/nao encontrado|not found|existe/i)
    } finally {
      await deleteFixtureUser(fixture.authUserId)
    }
  }, 20_000)

  it('login com credenciais validas retorna sessao e usuario', async () => {
    const fixture = await createFixtureUser('BUYER')
    try {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: fixture.email, password: fixture.password }),
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        session: { accessToken: string }
        user: { email: string; role: string }
      }
      expect(body.session.accessToken).toBeTruthy()
      expect(body.user.email).toBe(fixture.email)
      expect(body.user.role).toBe('BUYER')
    } finally {
      await deleteFixtureUser(fixture.authUserId)
    }
  }, 20_000)

  it('login para e-mail inexistente tambem retorna 401 (nao vaza existencia da conta)', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nao-existe-fase4@example.com', password: 'qualquer-coisa' }),
    })
    expect(res.status).toBe(401)
  })

  it('body JSON malformado retorna 400 (nunca 500)', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'isso-nao-e-json{{{',
    })
    expect(res.status).toBe(400)
  })

  it('sem body retorna 400 (nunca 500)', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /auth/logout', () => {
  it('sem token: 401', async () => {
    const res = await app.request('/auth/logout', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('com token valido: 200', async () => {
    const fixture = await createFixtureUser('BUYER')
    try {
      const loginRes = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: fixture.email, password: fixture.password }),
      })
      const { session } = (await loginRes.json()) as { session: { accessToken: string } }

      const res = await app.request('/auth/logout', {
        method: 'POST',
        headers: { authorization: `Bearer ${session.accessToken}` },
      })
      expect(res.status).toBe(200)
    } finally {
      await deleteFixtureUser(fixture.authUserId)
    }
  }, 20_000)
})

describe('GET /me', () => {
  it('sem token: 401', async () => {
    const res = await app.request('/me')
    expect(res.status).toBe(401)
  })

  it('com token valido: retorna o AuthedUser', async () => {
    const fixture = await createFixtureUser('STORE_OWNER')
    try {
      const loginRes = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: fixture.email, password: fixture.password }),
      })
      const { session } = (await loginRes.json()) as { session: { accessToken: string } }

      const res = await app.request('/me', {
        headers: { authorization: `Bearer ${session.accessToken}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { user: { email: string; role: string } }
      expect(body.user.email).toBe(fixture.email)
      expect(body.user.role).toBe('STORE_OWNER')
    } finally {
      await deleteFixtureUser(fixture.authUserId)
    }
  }, 20_000)
})
