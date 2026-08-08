import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Mesma estrategia de auth.unit.test.ts: mocka supabasePublic/prisma para
 * cobrir a logica das rotas de MFA sem depender do Supabase real (o projeto
 * de teste suporta MFA, mas exercitar TOTP real exigiria calcular o codigo
 * a cada corrida — a logica de rota e o que importa aqui).
 */
const setSession = vi.fn()
const enroll = vi.fn()
const challengeAndVerify = vi.fn()
const challenge = vi.fn()
const verify = vi.fn()
const unenroll = vi.fn()
const listFactors = vi.fn()
const getUser = vi.fn()
const userFindUnique = vi.fn()

vi.mock('../lib/supabaseClient', () => ({
  supabasePublic: {
    auth: {
      setSession,
      getUser,
      mfa: { enroll, challengeAndVerify, challenge, verify, unenroll, listFactors },
    },
  },
  supabaseAdmin: { auth: { admin: {} } },
  supabaseUrl: 'https://proj.supabase.co',
}))

vi.mock('../lib/prismaClient', () => ({
  prisma: { user: { findUnique: userFindUnique } },
}))

const AUTHED_USER = {
  id: 'user-1',
  authUserId: 'auth-1',
  email: 'a@example.com',
  role: 'BUYER',
  avatarUrl: null,
}

const authHeaders = { 'content-type': 'application/json', authorization: 'Bearer token-1' }

beforeEach(() => {
  vi.resetModules()
  setSession.mockReset()
  enroll.mockReset()
  challengeAndVerify.mockReset()
  challenge.mockReset()
  verify.mockReset()
  unenroll.mockReset()
  listFactors.mockReset()
  getUser.mockReset()
  userFindUnique.mockReset()

  setSession.mockResolvedValue({ data: {}, error: null })
  getUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null })
  userFindUnique.mockResolvedValue(AUTHED_USER)
})

describe('POST /mfa/enroll', () => {
  it('sem token: 401', async () => {
    const { app } = await import('../app')
    const res = await app.request('/mfa/enroll', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('sucesso: devolve factorId, qrCode e secret', async () => {
    enroll.mockResolvedValue({
      data: { id: 'factor-1', totp: { qr_code: 'data:image/svg+xml;base64,abc', secret: 'SECRET123' } },
      error: null,
    })

    const { app } = await import('../app')
    const res = await app.request('/mfa/enroll', { method: 'POST', headers: authHeaders })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ factorId: 'factor-1', qrCode: 'data:image/svg+xml;base64,abc', secret: 'SECRET123' })
  })

  it('erro do Supabase: 400', async () => {
    enroll.mockResolvedValue({ data: null, error: { message: 'falhou' } })

    const { app } = await import('../app')
    const res = await app.request('/mfa/enroll', { method: 'POST', headers: authHeaders })

    expect(res.status).toBe(400)
  })
})

describe('POST /mfa/verify', () => {
  it('codigo valido: confirma o enrollment', async () => {
    challengeAndVerify.mockResolvedValue({ data: {}, error: null })

    const { app } = await import('../app')
    const res = await app.request('/mfa/verify', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ factorId: 'factor-1', code: '123456' }),
    })

    expect(res.status).toBe(200)
    expect(challengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' })
  })

  it('codigo invalido: 400', async () => {
    challengeAndVerify.mockResolvedValue({ data: null, error: { message: 'invalid' } })

    const { app } = await import('../app')
    const res = await app.request('/mfa/verify', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ factorId: 'factor-1', code: '000000' }),
    })

    expect(res.status).toBe(400)
  })

  it('codigo com tamanho errado: 400 antes de chamar o Supabase', async () => {
    const { app } = await import('../app')
    const res = await app.request('/mfa/verify', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ factorId: 'factor-1', code: '123' }),
    })

    expect(res.status).toBe(400)
    expect(challengeAndVerify).not.toHaveBeenCalled()
  })
})

describe('POST /mfa/challenge', () => {
  it('sucesso: devolve challengeId', async () => {
    challenge.mockResolvedValue({ data: { id: 'challenge-1' }, error: null })

    const { app } = await import('../app')
    const res = await app.request('/mfa/challenge', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ factorId: 'factor-1' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ challengeId: 'challenge-1' })
  })
})

describe('POST /mfa/verify-challenge', () => {
  it('codigo valido: devolve sessao + user no mesmo shape do login', async () => {
    verify.mockResolvedValue({
      data: { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 },
      error: null,
    })

    const { app } = await import('../app')
    const res = await app.request('/mfa/verify-challenge', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ factorId: 'factor-1', challengeId: 'challenge-1', code: '123456' }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { session: { accessToken: string }; user: { id: string } }
    expect(body.session.accessToken).toBe('new-access')
    expect(body.user.id).toBe('user-1')
  })

  it('codigo invalido: 401', async () => {
    verify.mockResolvedValue({ data: null, error: { message: 'invalid' } })

    const { app } = await import('../app')
    const res = await app.request('/mfa/verify-challenge', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ factorId: 'factor-1', challengeId: 'challenge-1', code: '000000' }),
    })

    expect(res.status).toBe(401)
  })
})

describe('DELETE /mfa/:factorId', () => {
  it('sucesso: desativa o fator', async () => {
    unenroll.mockResolvedValue({ data: {}, error: null })

    const { app } = await import('../app')
    const res = await app.request('/mfa/factor-1', { method: 'DELETE', headers: authHeaders })

    expect(res.status).toBe(200)
    expect(unenroll).toHaveBeenCalledWith({ factorId: 'factor-1' })
  })

  it('erro do Supabase: 400', async () => {
    unenroll.mockResolvedValue({ data: null, error: { message: 'falhou' } })

    const { app } = await import('../app')
    const res = await app.request('/mfa/factor-1', { method: 'DELETE', headers: authHeaders })

    expect(res.status).toBe(400)
  })
})

describe('GET /mfa/factors', () => {
  it('lista fatores TOTP', async () => {
    listFactors.mockResolvedValue({
      data: { totp: [{ id: 'factor-1', status: 'verified', created_at: '2026-01-01T00:00:00.000Z' }] },
      error: null,
    })

    const { app } = await import('../app')
    const res = await app.request('/mfa/factors', { headers: authHeaders })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      factors: [{ id: 'factor-1', status: 'verified', createdAt: '2026-01-01T00:00:00.000Z' }],
    })
  })

  it('sem token: 401', async () => {
    const { app } = await import('../app')
    const res = await app.request('/mfa/factors')
    expect(res.status).toBe(401)
  })
})
