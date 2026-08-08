import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import MarketplaceApp from '../MarketplaceApp'
import OrdersScreen from '../screens/OrdersScreen'
import { ROUTES } from '../router/routes'
import { makeOrder } from './factories'
import { clickEnterAsClient as enterAsClient, waitForCatalog } from './authTestHelpers'
import { seedAddress } from './mocks/handlers'

/** WU-48 → fase de integração — histórico agora vem de GET /api/me/orders. */
const goTo = (path: string) => {
  window.history.pushState({}, '', path)
}

const baseProps = {
  orders: [],
  onRepeatOrder: vi.fn(),
  onOpenCart: vi.fn(),
  cartCount: 0,
  favoritesCount: 0,
}

describe('OrdersScreen — os tres estados', () => {
  it('carregando anuncia progresso', () => {
    render(<OrdersScreen {...baseProps} isLoading />)
    expect(screen.getByRole('status')).toHaveTextContent(/carregando/i)
  })

  it('erro mostra motivo e permite tentar de novo', () => {
    const onRetry = vi.fn()
    render(
      <OrdersScreen
        {...baseProps}
        error="Não foi possível carregar seus pedidos."
        onRetry={onRetry}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
    fireEvent.click(screen.getByRole('button', { name: /tentar de novo/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('sem pedidos, o estado vazio oferece uma saida', () => {
    render(<OrdersScreen {...baseProps} />)

    expect(screen.getByText(/nenhum pedido por aqui/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /explorar ofertas/i })).toHaveAttribute(
      'href',
      ROUTES.home,
    )
  })

  it('mostra id, status, valor e itens de cada pedido', () => {
    render(
      <OrdersScreen
        {...baseProps}
        orders={[
          makeOrder({
            id: '2042',
            value: 250,
            status: 'Em rota',
            items: ['Ventilador', 'Whey'],
            payment: 'Pix',
          }),
        ]}
      />,
    )

    expect(screen.getByText('2042')).toBeInTheDocument()
    expect(screen.getByText('Em rota')).toBeInTheDocument()
    expect(screen.getAllByText(/R\$\s?250,00/).length).toBeGreaterThan(0)
    expect(screen.getByText(/ventilador, whey/i)).toBeInTheDocument()
  })

  it('sem link de rastreio nesta fase — a tela de rastreio segue mock', () => {
    // Decisão da fase de integração: esconder o ponto de entrada é melhor do
    // que abrir /pedido/:id vazio para um pedido real que o mock não conhece.
    render(<OrdersScreen {...baseProps} orders={[makeOrder({ id: '2042' })]} />)

    expect(screen.queryByRole('link', { name: /acompanhar pedido/i })).not.toBeInTheDocument()
  })

  it('repetir pedido avisa o pai e respeita o alvo minimo de toque', () => {
    const onRepeatOrder = vi.fn()
    const order = makeOrder({ id: '2042', lines: [{ productId: '1', quantity: 2 }] })
    render(<OrdersScreen {...baseProps} orders={[order]} onRepeatOrder={onRepeatOrder} />)

    const button = screen.getByRole('button', { name: /repetir pedido 2042/i })
    expect(button.className).toMatch(/min-h-\[4[4-9]px\]|h-11|h-12/)

    fireEvent.click(button)
    expect(onRepeatOrder).toHaveBeenCalledWith(order)
  })

  it('falha ao repetir aparece como alerta, sem sumir com a lista', () => {
    render(
      <OrdersScreen
        {...baseProps}
        orders={[makeOrder({ id: '2042' })]}
        repeatError="Um dos produtos deste pedido saiu do catálogo."
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/saiu do catálogo/i)
    expect(screen.getByText('2042')).toBeInTheDocument()
  })
})

describe('historico ponta a ponta', () => {
  beforeEach(() => {
    localStorage.clear()
    goTo('/')
  })

  const bottomNav = () => screen.getByRole('navigation', { name: /navegação principal/i })

  it('pedido concluido entra no historico e repetir recria o carrinho igual', async () => {
    seedAddress()
    render(<MarketplaceApp />)
    enterAsClient()
    await waitForCatalog()

    const add = () =>
      fireEvent.click(
        screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement,
      )
    add()
    fireEvent.click(screen.getByRole('button', { name: /fechar carrinho/i }))
    add()

    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))

    // POST /api/orders cria o pedido (PENDING) e abre a etapa de pagamento
    // (Fase 2) — Pix é o método padrão do formulário de entrega.
    expect(await screen.findByRole('heading', { name: /pagamento/i })).toBeInTheDocument()
    // Pix puro também exige CPF/telefone (mesma exigência do servidor).
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-25' } })
    fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: '11987654321' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pagar' }))
    fireEvent.click(await screen.findByRole('button', { name: /ver meus pedidos/i }))

    await waitFor(() => expect(window.location.pathname).toBe(ROUTES.orders))
    expect(await screen.findByText(/ventilador de mesa premium/i)).toBeInTheDocument()

    // Pedido recém-criado é PENDING: cai na seção "Em andamento", com chip
    // destacado — é a "entrega" do cliente, ponta a ponta com a API real.
    const inProgress = screen.getByRole('region', { name: /pedidos em andamento/i })
    expect(within(inProgress).getByText(/ventilador de mesa premium/i)).toBeInTheDocument()
    expect(within(inProgress).getByText(/aguardando confirmação/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /repetir pedido/i }))

    // Mesmos itens e mesmas quantidades: 2 unidades do mesmo produto.
    expect(within(bottomNav()).getByRole('button', { name: /carrinho — 2 itens/i })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /carrinho de compras/i })).toBeInTheDocument()
  })

  it('deep link em /pedidos sem sessao volta para /entrar', () => {
    goTo(ROUTES.orders)
    render(<MarketplaceApp />)

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
  })
})
