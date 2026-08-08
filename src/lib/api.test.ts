import { describe, expect, it, vi, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'

import { server } from '../test/mocks/server'
import {
  api,
  ApiError,
  clearStoredSession,
  invalidateRefresh,
  loadStoredSession,
  setOnUnauthorized,
  storeSession,
} from './api'

const session = { accessToken: 'token-abc', refreshToken: 'refresh-abc', expiresAt: 9999999999 }

afterEach(() => {
  clearStoredSession()
  setOnUnauthorized(null)
})

describe('api client', () => {
  it('injeta o Bearer token da sessão persistida', async () => {
    storeSession(session)
    let authHeader: string | null = null
    server.use(
      http.get('/api/me', ({ request }) => {
        authHeader = request.headers.get('authorization')
        return HttpResponse.json({ user: { id: 'u1' } })
      }),
    )

    await api.me()
    expect(authHeader).toBe('Bearer token-abc')
  })

  it('sem sessão, não manda header Authorization', async () => {
    let authHeader: string | null = 'sentinela'
    server.use(
      http.get('/api/products', ({ request }) => {
        authHeader = request.headers.get('authorization')
        return HttpResponse.json({ products: [] })
      }),
    )

    await api.listProducts()
    expect(authHeader).toBeNull()
  })

  it('401 derruba a sessão persistida e avisa o app', async () => {
    storeSession(session)
    const onUnauthorized = vi.fn()
    setOnUnauthorized(onUnauthorized)
    server.use(
      http.get('/api/me', () => HttpResponse.json({ error: 'Nao autenticado' }, { status: 401 })),
    )

    await expect(api.me()).rejects.toBeInstanceOf(ApiError)
    expect(loadStoredSession()).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('erro carrega a mensagem pt-BR do body e o status', async () => {
    server.use(
      http.get('/api/products/:id', () =>
        HttpResponse.json({ error: 'Produto nao encontrado' }, { status: 404 }),
      ),
    )

    try {
      await api.getProduct('x')
      expect.unreachable('deveria ter lançado')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).message).toBe('Produto nao encontrado')
      expect((error as ApiError).status).toBe(404)
    }
  })

  it('body de erro sem shape esperado cai na mensagem genérica', async () => {
    server.use(http.get('/api/products', () => new HttpResponse('boom', { status: 500 })))

    await expect(api.listProducts()).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining('servidor'),
    })
  })

  it('token perto de expirar: renova antes da chamada e usa o novo token', async () => {
    storeSession({ accessToken: 'old-token', refreshToken: 'refresh-abc', expiresAt: Date.now() / 1000 + 30 })
    let refreshCalls = 0
    let usedAuthHeader: string | null = null
    server.use(
      http.post('/api/auth/refresh', () => {
        refreshCalls += 1
        return HttpResponse.json({
          session: { accessToken: 'new-token', refreshToken: 'refresh-def', expiresAt: 9999999999 },
        })
      }),
      http.get('/api/me', ({ request }) => {
        usedAuthHeader = request.headers.get('authorization')
        return HttpResponse.json({ user: { id: 'u1' } })
      }),
    )

    await api.me()

    expect(refreshCalls).toBe(1)
    expect(usedAuthHeader).toBe('Bearer new-token')
    expect(loadStoredSession()?.accessToken).toBe('new-token')
  })

  it('single-flight: chamadas concorrentes com token perto de expirar disparam só um refresh', async () => {
    storeSession({ accessToken: 'old-token', refreshToken: 'refresh-abc', expiresAt: Date.now() / 1000 + 30 })
    let refreshCalls = 0
    server.use(
      http.post('/api/auth/refresh', async () => {
        refreshCalls += 1
        await new Promise((resolve) => setTimeout(resolve, 20))
        return HttpResponse.json({
          session: { accessToken: 'new-token', refreshToken: 'refresh-def', expiresAt: 9999999999 },
        })
      }),
      http.get('/api/me', () => HttpResponse.json({ user: { id: 'u1' } })),
      http.get('/api/products', () => HttpResponse.json({ products: [] })),
    )

    await Promise.all([api.me(), api.listProducts()])

    expect(refreshCalls).toBe(1)
  })

  it('401 com sessão: tenta renovar 1x e refaz a chamada original antes de derrubar', async () => {
    storeSession({ accessToken: 'stale-token', refreshToken: 'refresh-abc', expiresAt: undefined })
    const onUnauthorized = vi.fn()
    setOnUnauthorized(onUnauthorized)
    let meCalls = 0
    server.use(
      http.post('/api/auth/refresh', () =>
        HttpResponse.json({
          session: { accessToken: 'new-token', refreshToken: 'refresh-def', expiresAt: 9999999999 },
        }),
      ),
      http.get('/api/me', ({ request }) => {
        meCalls += 1
        const auth = request.headers.get('authorization')
        if (auth === 'Bearer stale-token') {
          return HttpResponse.json({ error: 'Nao autenticado' }, { status: 401 })
        }
        return HttpResponse.json({ user: { id: 'u1' } })
      }),
    )

    const result = await api.me()

    expect(meCalls).toBe(2)
    expect(result).toEqual({ user: { id: 'u1' } })
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(loadStoredSession()?.accessToken).toBe('new-token')
  })

  it('401 e refresh também falha: derruba a sessão como antes', async () => {
    storeSession(session)
    const onUnauthorized = vi.fn()
    setOnUnauthorized(onUnauthorized)
    server.use(
      http.post('/api/auth/refresh', () =>
        HttpResponse.json({ error: 'Sessao expirada' }, { status: 401 }),
      ),
      http.get('/api/me', () => HttpResponse.json({ error: 'Nao autenticado' }, { status: 401 })),
    )

    await expect(api.me()).rejects.toBeInstanceOf(ApiError)
    expect(loadStoredSession()).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('logout com token explícito manda o Bearer mesmo com storage já limpo', async () => {
    let authHeader: string | null = null
    server.use(
      http.post('/api/auth/logout', ({ request }) => {
        authHeader = request.headers.get('authorization')
        return HttpResponse.json({ ok: true })
      }),
    )
    // Storage já limpo — como acontece de verdade no handleLogout, que captura
    // o token ANTES de chamar clearStoredSession().
    clearStoredSession()

    await api.logout('captured-token')

    expect(authHeader).toBe('Bearer captured-token')
  })

  it('regressão — refresh em voo que resolve DEPOIS do logout não ressuscita a sessão', async () => {
    storeSession({ accessToken: 'old-token', refreshToken: 'refresh-abc', expiresAt: Date.now() / 1000 + 30 })
    server.use(
      http.post('/api/auth/refresh', async () => {
        // Resolve só depois que o teste já invalidou/limpou — simula a
        // corrida real: refresh em voo quando o logout acontece.
        await new Promise((resolve) => setTimeout(resolve, 20))
        return HttpResponse.json({
          session: { accessToken: 'renewed-token', refreshToken: 'refresh-def', expiresAt: 9999999999 },
        })
      }),
      http.get('/api/me', () => HttpResponse.json({ user: { id: 'u1' } })),
    )

    // Dispara a chamada que vai perceber o token perto de expirar e iniciar
    // o refresh em voo — sem aguardar ainda.
    const inFlight = api.me()

    // Logout acontece ENQUANTO o refresh está em voo: storage limpo +
    // geração invalidada, exatamente a ordem de handleLogout.
    clearStoredSession()
    invalidateRefresh()

    await inFlight

    // O refresh renovou o token no servidor, mas como o logout invalidou a
    // geração antes dele terminar, a sessão renovada NUNCA deve voltar ao
    // storage — senão a pessoa "continua logada" depois de sair.
    expect(loadStoredSession()).toBeNull()
  })

  it('409 de estoque expõe o body discriminado para o checkout', async () => {
    storeSession(session)
    server.use(
      http.post('/api/orders', () =>
        HttpResponse.json(
          { error: 'Estoque insuficiente', items: [{ productId: 'p1' }] },
          { status: 409 },
        ),
      ),
    )

    try {
      await api.createOrder({ items: [{ productId: 'p1', quantity: 1 }], addressId: 'a1' })
      expect.unreachable('deveria ter lançado')
    } catch (error) {
      const apiError = error as ApiError
      expect(apiError.status).toBe(409)
      expect(apiError.body).toMatchObject({ items: [{ productId: 'p1' }] })
    }
  })
})
