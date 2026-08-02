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

vi.mock('../lib/supabaseClient', () => ({
  supabasePublic: { auth: { signUp } },
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
