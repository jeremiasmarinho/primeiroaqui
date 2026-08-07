import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Complemento determinístico de `auth.test.ts`: os testes de integracao la
 * batem no Supabase real e podem ser pulados sob rate limit de e-mail (ver
 * comentario naquele arquivo). Aqui mockamos `supabasePublic`/`prisma` para
 * cobrir a mesma logica de negocio (role sempre BUYER, deteccao de
 * duplicado) sem depender de rede nem de limites de infra.
 */
const signUp = vi.fn()
const userCreate = vi.fn()
const resetPasswordForEmail = vi.fn()
const setSession = vi.fn()
const updateUser = vi.fn()
const refreshSession = vi.fn()

vi.mock('../lib/supabaseClient', () => ({
  supabasePublic: { auth: { signUp, resetPasswordForEmail, setSession, updateUser, refreshSession } },
  supabaseAdmin: { auth: { admin: {} } },
}))

vi.mock('../lib/prismaClient', () => ({
  prisma: { user: { create: userCreate } },
}))

describe('POST /auth/signup (logica isolada, sem rede)', () => {
  beforeEach(() => {
    vi.resetModules()
    signUp.mockReset()
    userCreate.mockReset()
    resetPasswordForEmail.mockReset()
    setSession.mockReset()
    updateUser.mockReset()
    refreshSession.mockReset()
  })

  it('ignora role vindo do body e cria sempre com BUYER', async () => {
    signUp.mockResolvedValue({
      data: { user: { id: 'auth-1', identities: [{ id: 'identity-1' }] } },
      error: null,
    })
    userCreate.mockResolvedValue({
      id: 'user-1',
      authUserId: 'auth-1',
      email: 'a@example.com',
      name: 'A',
      role: 'BUYER',
    })

    const { app } = await import('../app')
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', password: 'senha-longa-123', name: 'A', role: 'ADMIN' }),
    })

    expect(res.status).toBe(201)
    expect(userCreate).toHaveBeenCalledWith({
      data: { authUserId: 'auth-1', email: 'a@example.com', name: 'A', role: 'BUYER' },
    })
  })

  it('e-mail ja cadastrado (identities vazio, sem erro explicito): 409', async () => {
    signUp.mockResolvedValue({ data: { user: { id: 'auth-2', identities: [] } }, error: null })

    const { app } = await import('../app')
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'dup@example.com', password: 'senha-longa-123', name: 'B' }),
    })

    expect(res.status).toBe(409)
    expect(userCreate).not.toHaveBeenCalled()
  })

  it('erro generico do Supabase no signup: 409', async () => {
    signUp.mockResolvedValue({
      data: { user: null },
      error: { status: 422, message: 'User already registered' },
    })

    const { app } = await import('../app')
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'c@example.com', password: 'senha-longa-123', name: 'C' }),
    })

    expect(res.status).toBe(409)
  })

  it('rate limit do Supabase (429) e repassado como 429, nao mascarado como 409', async () => {
    signUp.mockResolvedValue({
      data: { user: null },
      error: { status: 429, message: 'email rate limit exceeded' },
    })

    const { app } = await import('../app')
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'd@example.com', password: 'senha-longa-123', name: 'D' }),
    })

    expect(res.status).toBe(429)
  })

  it('body invalido nunca chega a chamar o Supabase', async () => {
    const { app } = await import('../app')
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nao-e-email', password: '123', name: '' }),
    })

    expect(res.status).toBe(400)
    expect(signUp).not.toHaveBeenCalled()
  })
})

describe('POST /auth/forgot-password', () => {
  beforeEach(() => {
    vi.resetModules()
    resetPasswordForEmail.mockReset()
  })

  it('e-mail existente: 200 generico e chama resetPasswordForEmail com redirectTo', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })

    const { app } = await import('../app')
    const res = await app.request('/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://app.exemplo.com' },
      body: JSON.stringify({ email: 'existe@teste.com' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(resetPasswordForEmail).toHaveBeenCalledWith('existe@teste.com', {
      redirectTo: 'https://app.exemplo.com/redefinir-senha',
    })
  })

  it('e-mail inexistente: mesma resposta 200 generica (anti-enumeracao)', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: { message: 'User not found' } })

    const { app } = await import('../app')
    const res = await app.request('/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://app.exemplo.com' },
      body: JSON.stringify({ email: 'nao-existe@teste.com' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('falha de rede com o Supabase nao vaza: ainda 200', async () => {
    resetPasswordForEmail.mockRejectedValue(new Error('network down'))

    const { app } = await import('../app')
    const res = await app.request('/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://app.exemplo.com' },
      body: JSON.stringify({ email: 'x@teste.com' }),
    })

    expect(res.status).toBe(200)
  })

  it('e-mail invalido: 400 antes de tocar no Supabase', async () => {
    const { app } = await import('../app')
    const res = await app.request('/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nao-e-email' }),
    })

    expect(res.status).toBe(400)
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('sem body: 400 (nunca 500)', async () => {
    const { app } = await import('../app')
    const res = await app.request('/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /auth/reset-password', () => {
  beforeEach(() => {
    vi.resetModules()
    setSession.mockReset()
    updateUser.mockReset()
  })

  it('tokens e senha validos: troca a senha e responde 200', async () => {
    setSession.mockResolvedValue({ data: {}, error: null })
    updateUser.mockResolvedValue({ data: {}, error: null })

    const { app } = await import('../app')
    const res = await app.request('/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        password: 'senha-nova-123',
      }),
    })

    expect(res.status).toBe(200)
    expect(setSession).toHaveBeenCalledWith({ access_token: 'access-1', refresh_token: 'refresh-1' })
    expect(updateUser).toHaveBeenCalledWith({ password: 'senha-nova-123' })
  })

  it('token invalido/expirado: 401, nunca chama updateUser', async () => {
    setSession.mockResolvedValue({ data: {}, error: { message: 'invalid token' } })

    const { app } = await import('../app')
    const res = await app.request('/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        accessToken: 'bad',
        refreshToken: 'bad',
        password: 'senha-nova-123',
      }),
    })

    expect(res.status).toBe(401)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('senha curta: 400 antes de tocar no Supabase', async () => {
    const { app } = await import('../app')
    const res = await app.request('/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accessToken: 'a', refreshToken: 'b', password: '123' }),
    })

    expect(res.status).toBe(400)
    expect(setSession).not.toHaveBeenCalled()
  })

  it('updateUser falha: 400', async () => {
    setSession.mockResolvedValue({ data: {}, error: null })
    updateUser.mockResolvedValue({ data: {}, error: { message: 'weak password' } })

    const { app } = await import('../app')
    const res = await app.request('/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accessToken: 'a', refreshToken: 'b', password: 'senha-nova-123' }),
    })

    expect(res.status).toBe(400)
  })

  it('sem body: 400 (nunca 500)', async () => {
    const { app } = await import('../app')
    const res = await app.request('/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /auth/refresh', () => {
  beforeEach(() => {
    vi.resetModules()
    refreshSession.mockReset()
  })

  it('refresh token valido: devolve nova sessao', async () => {
    refreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_at: 1234567890,
        },
      },
      error: null,
    })

    const { app } = await import('../app')
    const res = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'old-refresh' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      session: { accessToken: 'new-access', refreshToken: 'new-refresh', expiresAt: 1234567890 },
    })
    expect(refreshSession).toHaveBeenCalledWith({ refresh_token: 'old-refresh' })
  })

  it('refresh token invalido/revogado: 401', async () => {
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: 'invalid' } })

    const { app } = await import('../app')
    const res = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'bad' }),
    })

    expect(res.status).toBe(401)
  })

  it('sem refreshToken: 400', async () => {
    const { app } = await import('../app')
    const res = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    expect(refreshSession).not.toHaveBeenCalled()
  })
})
