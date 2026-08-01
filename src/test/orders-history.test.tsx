import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import MarketplaceApp from '../MarketplaceApp'
import OrdersScreen from '../screens/OrdersScreen'
import { ROUTES } from '../router/routes'
import { STORAGE_KEYS } from '../state/session'
import { makeOrder } from './factories'

/** WU-48 — histórico de pedidos e "repetir pedido". */
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

  it('erro mostra motivo e saida', () => {
    render(<OrdersScreen {...baseProps} error="Não foi possível carregar seus pedidos." />)

    expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
    expect(screen.getByRole('link', { name: /explorar ofertas/i })).toHaveAttribute(
      'href',
      ROUTES.home,
    )
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
    expect(screen.getByText(/R\$\s?250,00/)).toBeInTheDocument()
    expect(screen.getByText(/ventilador, whey/i)).toBeInTheDocument()
  })

  it('cada pedido linka para o rastreio ja existente, sem duplicar tela', () => {
    render(<OrdersScreen {...baseProps} orders={[makeOrder({ id: '2042' })]} />)

    expect(screen.getByRole('link', { name: /acompanhar pedido 2042/i })).toHaveAttribute(
      'href',
      ROUTES.order('2042'),
    )
  })

  it('repetir pedido avisa o pai e respeita o alvo minimo de toque', () => {
    const onRepeatOrder = vi.fn()
    const order = makeOrder({ id: '2042', lines: [{ productId: 1, quantity: 2 }] })
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

  const enterAsClient = () => {
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))
  }

  const bottomNav = () => screen.getByRole('navigation', { name: /navegação principal/i })

  const buyTwoOfTheFirstProduct = () => {
    const add = () =>
      fireEvent.click(
        screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement,
      )
    add()
    fireEvent.click(screen.getByRole('button', { name: /fechar carrinho/i }))
    add()

    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Endereço'), { target: { value: 'Rua 1, 20' } })
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Centro' } })
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '12345678' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))
  }

  it('pedido concluido entra no historico e repetir recria o carrinho igual', () => {
    render(<MarketplaceApp />)
    enterAsClient()
    buyTwoOfTheFirstProduct()

    // Confirmar leva ao rastreio; de la se alcanca o historico por link real.
    fireEvent.click(screen.getByRole('link', { name: /ver todos os pedidos/i }))
    expect(window.location.pathname).toBe(ROUTES.orders)

    const novo = screen.getByText('1004')
    expect(novo).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /repetir pedido 1004/i }))

    // Mesmos itens e mesmas quantidades: 2 unidades do mesmo produto.
    expect(within(bottomNav()).getByRole('button', { name: /carrinho — 2 itens/i })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /carrinho de compras/i })).toBeInTheDocument()
  })

  it('pedido do historico antigo, sem linhas, explica por que nao repete', () => {
    localStorage.setItem(
      STORAGE_KEYS.user,
      JSON.stringify({ name: 'Ana', email: 'ana@teste.com', role: 'client' }),
    )
    goTo(ROUTES.orders)
    render(<MarketplaceApp />)

    fireEvent.click(screen.getAllByRole('button', { name: /repetir pedido/i })[0] as HTMLElement)
    expect(screen.getByRole('alert')).toHaveTextContent(/não guarda os itens/i)
  })

  it('deep link em /pedidos sem sessao volta para /entrar', () => {
    goTo(ROUTES.orders)
    render(<MarketplaceApp />)

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
  })
})
