import { describe, expect, it, vi, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'

import { server } from '../test/mocks/server'
import {
  api,
  ApiError,
  clearStoredSession,
  loadStoredSession,
  setOnUnauthorized,
  storeSession,
} from './api'

const session = { accessToken: 'token-abc', refreshToken: 'refresh-abc', expiresAt: 999 }

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
