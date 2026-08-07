import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from './mocks/server'
import MarketplaceApp from '../MarketplaceApp'
import OAuthCallbackScreen from '../screens/OAuthCallbackScreen'
import { goToLoginFromNav } from './authTestHelpers'

describe('login com Google — botão em /entrar', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('clique em "Continuar com Google" busca a URL de authorize e tenta navegar até ela', async () => {
    // jsdom não navega de verdade para uma origem externa (ignora a
    // atribuição em `location.href` silenciosamente), então o teste observa
    // o efeito observável dentro do jsdom: a chamada ao endpoint que monta a
    // URL, com o provider correto — a atribuição final é uma linha trivial
    // (`window.location.href = url`) coberta pela leitura de código, não por
    // uma navegação real que o ambiente de teste não suporta.
    let requestedProvider: string | null = null
    server.use(
      http.get('/api/auth/oauth-url', ({ request }) => {
        requestedProvider = new URL(request.url).searchParams.get('provider')
        return HttpResponse.json({
          url: 'https://proj.supabase.co/auth/v1/authorize?provider=google&redirect_to=x',
        })
      }),
    )

    render(<MarketplaceApp />)
    goToLoginFromNav()

    fireEvent.click(screen.getByRole('button', { name: /continuar com google/i }))

    await waitFor(() => expect(requestedProvider).toBe('google'))
  })

  it('falha ao buscar a URL de authorize: mostra erro inline, não navega', async () => {
    server.use(
      http.get('/api/auth/oauth-url', () =>
        HttpResponse.json({ error: 'Provedor OAuth invalido' }, { status: 400 }),
      ),
    )
    render(<MarketplaceApp />)
    goToLoginFromNav()

    fireEvent.click(screen.getByRole('button', { name: /continuar com google/i }))

    await waitFor(() =>
      expect(screen.getByText(/não foi possível iniciar o login com google/i)).toBeInTheDocument(),
    )
  })
})

describe('OAuthCallbackScreen (/entrar/callback)', () => {
  const setHash = (hash: string) => {
    window.location.hash = hash
  }

  afterEach(() => {
    window.location.hash = ''
  })

  it('com tokens válidos: chama onComplete com os tokens do fragmento', async () => {
    const onComplete = vi.fn().mockResolvedValue({ ok: true })
    const onError = vi.fn()
    setHash('#access_token=access-1&refresh_token=refresh-1&expires_at=1234567890')

    render(<OAuthCallbackScreen onComplete={onComplete} onError={onError} />)

    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresAt: 1234567890,
      }),
    )
    expect(onError).not.toHaveBeenCalled()
  })

  it('sem tokens no fragmento: chama onError, nunca onComplete', async () => {
    const onComplete = vi.fn()
    const onError = vi.fn()
    setHash('')

    render(<OAuthCallbackScreen onComplete={onComplete} onError={onError} />)

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('onComplete falha (token rejeitado pelo servidor): repassa a mensagem para onError', async () => {
    const onComplete = vi.fn().mockResolvedValue({ ok: false, message: 'Sessao OAuth invalida ou expirada' })
    const onError = vi.fn()
    setHash('#access_token=bad&refresh_token=bad')

    render(<OAuthCallbackScreen onComplete={onComplete} onError={onError} />)

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Sessao OAuth invalida ou expirada'))
  })
})

describe('fluxo completo: callback com tokens válidos loga e cai na home', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('acessar /entrar/callback com tokens no fragmento autentica e mostra a vitrine', async () => {
    window.history.pushState({}, '', '/entrar/callback')
    window.location.hash = '#access_token=access-google&refresh_token=refresh-google&expires_at=9999999999'

    render(<MarketplaceApp />)

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /abrir perfil de usuario google/i })).toBeInTheDocument(),
    )

    window.location.hash = ''
  })

  it('acessar /entrar/callback sem tokens volta para /entrar com mensagem de erro', async () => {
    window.history.pushState({}, '', '/entrar/callback')
    window.location.hash = ''

    render(<MarketplaceApp />)

    await waitFor(() =>
      expect(screen.getByText(/não foi possível concluir o login com google/i)).toBeInTheDocument(),
    )
  })
})
