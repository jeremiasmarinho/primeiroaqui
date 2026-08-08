import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import MarketplaceApp from '../MarketplaceApp'
import { ROUTES } from '../router/routes'
import { setHardNavigateForTests } from '../lib/hardNavigate'
import { waitForCatalog } from './authTestHelpers'
import { server } from './mocks/server'
import { db } from './mocks/handlers'

const bottomNav = () => screen.getByRole('navigation', { name: /navegação principal/i })

describe('visitante — favoritar', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('favoritar como visitante redireciona para login com mensagem de contexto', async () => {
    render(<MarketplaceApp />)
    await waitForCatalog()
    const heart = screen.getAllByRole('button', { name: /^salvar .+ nos favoritos$/i })[0] as HTMLElement
    fireEvent.click(heart)

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByText(/faça login para favoritar/i)).toBeInTheDocument()
  })

  it('apos logar, o favorito e aplicado e a pessoa volta pra onde estava', async () => {
    render(<MarketplaceApp />)
    await waitForCatalog()
    const heart = screen.getAllByRole('button', { name: /^salvar .+ nos favoritos$/i })[0] as HTMLElement
    const title = heart.getAttribute('aria-label')?.replace(/^Salvar /, '').replace(/ nos favoritos$/, '') ?? ''
    fireEvent.click(heart)

    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))

    expect(window.location.pathname).toBe('/')
    // Resolução da intenção pendente agora é assíncrona (pode esperar a
    // hidratação de /me/favorites e/ou um GET /products/:id — ver
    // resolveFavoriteIntent em useMarketplaceState.ts), então o favorito não
    // fica pronto na mesma tick síncrona do clique.
    // Nota: `title` (ex. "Ventilador de Mesa Premium...") pode ter card duplicado
    // na home (rail "Entrega turbo" + grade de catálogo, quando o produto é
    // `express`) — comportamento pré-existente, fora do escopo da Task 4.
    // Por isso usamos getAllByRole (>=1) em vez de getByRole (exatamente 1).
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: new RegExp(`^remover ${title} dos favoritos$`, 'i') }).length,
      ).toBeGreaterThanOrEqual(1),
    )
  })

  /**
   * Regressão do bug real (e2e/jornada-visitante.spec.ts): o login rápido de
   * desenvolvimento (`onQuickLogin`) NÃO recarrega a página — diferente do
   * login por senha/Google — então resolvia a intenção de favorito na hora,
   * mesmo que o catálogo remoto (`remoteCatalog.products`) ainda não tivesse
   * chegado (ou não contivesse o produto, já que GET /products é uma janela
   * de até 50 itens — ver useRemoteCatalog.ts). `products.find(...)` não
   * achava o produto, e o favorito virava no-op silencioso — pior ainda: o
   * `pendingLoginResolvedRef` já marcava a intenção como "resolvida",
   * perdendo-a PERMANENTEMENTE. Corrigido buscando o produto direto por id
   * (GET /products/:id) quando não está no catálogo já carregado — ver
   * `resolveFavoriteIntent` em useMarketplaceState.ts.
   *
   * Reproduzido de forma DETERMINÍSTICA (sem depender de timing/delay de
   * verdade, que pode "acidentalmente" passar se o catálogo resolver rápido
   * demais): GET /products (lista completa) fica preso numa Promise que só
   * a própria asserção libera, DEPOIS dos dois cliques (favoritar + login
   * rápido). Nesse instante o catálogo está garantidamente vazio — é
   * exatamente a janela onde o bug antigo perdia o favorito. A página do
   * produto usa GET /products/:id (não afetado), então o coração aparece
   * normalmente antes do catálogo completo chegar.
   */
  it('favoritar na página do produto com o catálogo ainda carregando: aplica assim que o catálogo chega', async () => {
    const productId = db.products[0]!.id
    const productTitle = db.products[0]!.title

    let releaseCatalog: () => void = () => {}
    const catalogGate = new Promise<void>((resolve) => {
      releaseCatalog = resolve
    })
    server.use(
      http.get('/api/products', async ({ request }) => {
        const url = new URL(request.url)
        // Só trava a listagem completa (sem storeId) — a página do produto
        // usa GET /products/:id, que não passa por aqui.
        if (!url.searchParams.get('storeId')) await catalogGate
        return HttpResponse.json({ products: db.products })
      }),
    )

    window.history.pushState({}, '', ROUTES.product(productId))
    render(<MarketplaceApp />)

    const heart = await screen.findByRole('button', { name: /^salvar .+ nos favoritos$/i })
    fireEvent.click(heart)
    // Catálogo completo AINDA preso (releaseCatalog não foi chamado) — login
    // rápido não pode perder a intenção pendente nesta janela.
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))

    releaseCatalog()

    await waitFor(() =>
      expect(
        screen.getAllByRole('button', {
          name: new RegExp(`^remover ${productTitle} dos favoritos$`, 'i'),
        }).length,
      ).toBeGreaterThanOrEqual(1),
    )
  })
})

describe('login por senha real — navegação dura (hardNavigate)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('a intenção pendente sobrevive a um reload de verdade via sessionStorage e é aplicada no remount', async () => {
    // Este teste NÃO usa o mock padrão de hardNavigate (que reescreve a URL
    // e mantém a árvore React montada — bom o bastante pra maioria dos
    // testes, mas não prova a persistência). Aqui só capturamos o path e
    // simulamos o reload de VERDADE: desmontamos a árvore (perde memória) e
    // remontamos, exatamente como spec pede.
    let capturedPath: string | null = null
    setHardNavigateForTests((path) => {
      capturedPath = path
    })

    const first = render(<MarketplaceApp />)
    await waitForCatalog()
    const heart = screen.getAllByRole('button', { name: /^salvar .+ nos favoritos$/i })[0] as HTMLElement
    const title = heart.getAttribute('aria-label')?.replace(/^Salvar /, '').replace(/ nos favoritos$/, '') ?? ''
    fireEvent.click(heart)

    fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'ana@teste.com' } })
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'senha-valida-123' } })
    fireEvent.submit(screen.getByPlaceholderText('Senha').closest('form') as HTMLFormElement)

    await waitFor(() => expect(capturedPath).toBe('/'))
    // handleAuthSubmit gravou a intenção pendente no sessionStorage antes de
    // "navegar" — é o que sobrevive a um reload de verdade.
    const raw = sessionStorage.getItem('primeiroaqui_pending_login')
    expect(raw).toContain('favorite')

    // Simula o reload: desmonta (perde todo o estado em memória) e remonta.
    first.unmount()
    render(<MarketplaceApp />)

    // Cadeia mais longa de round-trips nesse caminho (GET /me → hidratação
    // de /favoritos + resolução da intenção, possivelmente com fallback
    // GET /products/:id se o catálogo do remount ainda não chegou) — ver
    // resolveFavoriteIntent em useMarketplaceState.ts. Timeout maior que o
    // default para não flaquear à toa.
    await waitFor(
      () =>
        expect(
          screen.getAllByRole('button', { name: new RegExp(`^remover ${title} dos favoritos$`, 'i') })
            .length,
        ).toBeGreaterThanOrEqual(1),
      { timeout: 3000 },
    )
    // Consumido — um F5 manual subsequente não reaplica nada.
    expect(sessionStorage.getItem('primeiroaqui_pending_login')).toBeNull()
  })
})

describe('visitante — checkout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('continuar no carrinho como visitante redireciona para login com mensagem de contexto', async () => {
    render(<MarketplaceApp />)
    await waitForCatalog()
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByText(/faça login para continuar sua compra/i)).toBeInTheDocument()
  })

  it('apos logar, retoma a etapa de entrega com o carrinho intacto', async () => {
    render(<MarketplaceApp />)
    await waitForCatalog()
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))

    expect(screen.getByLabelText('Seu nome')).toBeInTheDocument()
    expect(within(bottomNav()).getByRole('button', { name: /carrinho — 1 itens/i })).toBeInTheDocument()
  })

  it('comprar agora como visitante fecha a gaveta do carrinho antes de redirecionar para login', async () => {
    // Regressão: o backdrop fixo da gaveta (fixed inset-0), se deixado
    // aberto, fica por cima do formulário de login e bloqueia o clique em
    // navegador real (fireEvent não pega isso, só Playwright). Este teste
    // prova que `guardedBuyNow` fecha a gaveta antes do redirecionamento —
    // nenhum `dialog` da gaveta pode seguir montado na tela de login.
    window.history.pushState({}, '', ROUTES.product(1))
    render(<MarketplaceApp />)
    fireEvent.click(await screen.findByRole('button', { name: /comprar agora/i }))

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('comprar agora como visitante adiciona ao carrinho e so entao redireciona', async () => {
    window.history.pushState({}, '', ROUTES.product(1))
    render(<MarketplaceApp />)
    fireEvent.click(await screen.findByRole('button', { name: /comprar agora/i }))

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))

    // A retomada aqui volta para `/produto/1` (rota de origem), que não
    // renderiza BottomNav — diferente do fluxo "continuar no carrinho", que
    // parte e retorna para `/`. Por isso confirmamos o carrinho intacto pela
    // gaveta de entrega (que já está aberta), não pela barra inferior.
    expect(screen.getByLabelText('Seu nome')).toBeInTheDocument()
    const deliveryDrawer = screen.getByRole('dialog', { name: /dados de entrega/i })
    expect(within(deliveryDrawer).getByText('Itens').nextElementSibling).toHaveTextContent(/^1$/)
  })
})

describe('visitante — clique explicito em Entrar', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('clicar em Entrar na barra inferior nao mostra mensagem de contexto', () => {
    render(<MarketplaceApp />)
    fireEvent.click(within(bottomNav()).getByRole('link', { name: 'Entrar' }))

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.queryByText(/faça login para/i)).not.toBeInTheDocument()
  })
})

describe('degradacao aceitavel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('reload em /entrar perde a retomada automatica, mas nao quebra', async () => {
    const first = render(<MarketplaceApp />)
    await waitForCatalog()
    fireEvent.click(screen.getAllByRole('button', { name: /^salvar .+ nos favoritos$/i })[0] as HTMLElement)
    first.unmount()

    render(<MarketplaceApp />)
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))

    expect(window.location.pathname).toBe('/')
  })
})
