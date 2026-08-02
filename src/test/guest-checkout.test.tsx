import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'
import { ROUTES } from '../router/routes'

const bottomNav = () => screen.getByRole('navigation', { name: /navegação principal/i })

describe('visitante — favoritar', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('favoritar como visitante redireciona para login com mensagem de contexto', () => {
    render(<MarketplaceApp />)
    const heart = screen.getAllByRole('button', { name: /^salvar .+ nos favoritos$/i })[0] as HTMLElement
    fireEvent.click(heart)

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByText(/faça login para favoritar/i)).toBeInTheDocument()
  })

  it('apos logar, o favorito e aplicado e a pessoa volta pra onde estava', () => {
    render(<MarketplaceApp />)
    const heart = screen.getAllByRole('button', { name: /^salvar .+ nos favoritos$/i })[0] as HTMLElement
    const title = heart.getAttribute('aria-label')?.replace(/^Salvar /, '').replace(/ nos favoritos$/, '') ?? ''
    fireEvent.click(heart)

    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))

    expect(window.location.pathname).toBe('/')
    // Nota: `title` (ex. "Ventilador de Mesa Premium...") pode ter card duplicado
    // na home (rail "Entrega turbo" + grade de catálogo, quando o produto é
    // `express`) — comportamento pré-existente, fora do escopo da Task 4.
    // Por isso usamos getAllByRole (>=1) em vez de getByRole (exatamente 1).
    expect(
      screen.getAllByRole('button', { name: new RegExp(`^remover ${title} dos favoritos$`, 'i') }).length,
    ).toBeGreaterThanOrEqual(1)
  })
})

describe('visitante — checkout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('continuar no carrinho como visitante redireciona para login com mensagem de contexto', () => {
    render(<MarketplaceApp />)
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByText(/faça login para continuar sua compra/i)).toBeInTheDocument()
  })

  it('apos logar, retoma a etapa de entrega com o carrinho intacto', () => {
    render(<MarketplaceApp />)
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))

    expect(screen.getByLabelText('Seu nome')).toBeInTheDocument()
    expect(within(bottomNav()).getByRole('button', { name: /carrinho — 1 itens/i })).toBeInTheDocument()
  })

  it('comprar agora como visitante fecha a gaveta do carrinho antes de redirecionar para login', () => {
    // Regressão: o backdrop fixo da gaveta (fixed inset-0), se deixado
    // aberto, fica por cima do formulário de login e bloqueia o clique em
    // navegador real (fireEvent não pega isso, só Playwright). Este teste
    // prova que `guardedBuyNow` fecha a gaveta antes do redirecionamento —
    // nenhum `dialog` da gaveta pode seguir montado na tela de login.
    window.history.pushState({}, '', ROUTES.product(1))
    render(<MarketplaceApp />)
    fireEvent.click(screen.getByRole('button', { name: /comprar agora/i }))

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('comprar agora como visitante adiciona ao carrinho e so entao redireciona', () => {
    window.history.pushState({}, '', ROUTES.product(1))
    render(<MarketplaceApp />)
    fireEvent.click(screen.getByRole('button', { name: /comprar agora/i }))

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))

    // A retomada aqui volta para `/produto/1` (rota de origem), que não
    // renderiza BottomNav — diferente do fluxo "continuar no carrinho", que
    // parte e retorna para `/`. Por isso confirmamos o carrinho intacto pela
    // gaveta de entrega (que já está aberta), não pela barra inferior.
    expect(screen.getByLabelText('Seu nome')).toBeInTheDocument()
    const deliveryDrawer = screen.getByRole('dialog', { name: /dados de entrega/i })
    expect(within(deliveryDrawer).getByText('Itens').nextElementSibling).toHaveTextContent('1')
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

  it('reload em /entrar perde a retomada automatica, mas nao quebra', () => {
    const first = render(<MarketplaceApp />)
    fireEvent.click(screen.getAllByRole('button', { name: /^salvar .+ nos favoritos$/i })[0] as HTMLElement)
    first.unmount()

    render(<MarketplaceApp />)
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))

    expect(window.location.pathname).toBe('/')
  })
})
