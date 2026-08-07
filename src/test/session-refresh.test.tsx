import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from './mocks/server'
import MarketplaceApp from '../MarketplaceApp'
import { SESSION_STORAGE_KEY } from '../lib/api'
import { STORAGE_KEYS } from '../state/session'

/**
 * Cobertura de tela do refresh transparente (WU login/B2): uma sessão
 * persistida com token perto de expirar deve ser renovada nos bastidores —
 * sem 401 visível, sem derrubar a pessoa para /entrar.
 */
describe('refresh transparente de sessão', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('token perto de expirar: a tela carrega normalmente e a sessão é renovada', async () => {
    localStorage.setItem(
      STORAGE_KEYS.user,
      JSON.stringify({ name: 'Ana Paula', email: 'ana@teste.com', role: 'BUYER' }),
    )
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        accessToken: 'quase-expirando',
        refreshToken: 'refresh-valido',
        expiresAt: Date.now() / 1000 + 10,
      }),
    )

    render(<MarketplaceApp />)

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '{}')
      expect(stored.accessToken).toBe('test-token-renovado')
    })

    // Sessão continua ativa — não caiu para a tela de login.
    expect(screen.queryByText(/compre no bairro e gerencie suas vendas/i)).not.toBeInTheDocument()
  })

  it('refresh token invalido: sessão cai e app volta para login', async () => {
    server.use(
      http.get('/api/me', ({ request }) => {
        const auth = request.headers.get('authorization')
        if (auth === 'Bearer expirado-de-vez') {
          return HttpResponse.json({ error: 'Nao autenticado' }, { status: 401 })
        }
        return HttpResponse.json({ user: { id: 'u1', name: 'Ana', email: 'ana@teste.com', role: 'BUYER' } })
      }),
    )
    localStorage.setItem(
      STORAGE_KEYS.user,
      JSON.stringify({ name: 'Ana Paula', email: 'ana@teste.com', role: 'BUYER' }),
    )
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        accessToken: 'expirado-de-vez',
        refreshToken: 'refresh-invalido',
        expiresAt: 9999999999,
      }),
    )

    render(<MarketplaceApp />)

    await waitFor(() => expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull())
  })
})
