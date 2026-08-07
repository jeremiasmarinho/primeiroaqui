import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

import OrdersScreen from '../screens/OrdersScreen'
import { makeOrder } from './factories'

/**
 * Dashboard "Minhas compras": cards-resumo e agrupamento em
 * andamento/anteriores derivados client-side de GET /me/orders.
 */

const baseProps = {
  onRepeatOrder: vi.fn(),
  onOpenCart: vi.fn(),
  cartCount: 0,
  favoritesCount: 0,
}

describe('OrdersScreen — dashboard "Minhas compras"', () => {
  it('cards-resumo calculam total, em andamento, entregues e total gasto', () => {
    const orders = [
      makeOrder({ id: 'p1', value: 100, status: 'Aguardando confirmação', rawStatus: 'PENDING' }),
      makeOrder({ id: 'p2', value: 50, status: 'Em preparação', rawStatus: 'PREPARING' }),
      makeOrder({ id: 'p3', value: 200, status: 'Entregue', rawStatus: 'DELIVERED' }),
      makeOrder({ id: 'p4', value: 999, status: 'Cancelado', rawStatus: 'CANCELED' }),
    ]

    render(<OrdersScreen {...baseProps} orders={orders} />)

    const summary = screen.getByRole('list', { name: /resumo das compras/i })
    const [totalTile, inProgressTile, deliveredTile, spentTile] = within(summary).getAllByRole('listitem')

    expect(within(totalTile!).getByText('4')).toBeInTheDocument() // total de pedidos
    expect(within(inProgressTile!).getByText('2')).toBeInTheDocument() // em andamento
    expect(within(deliveredTile!).getByText('1')).toBeInTheDocument() // entregues
    // Total gasto exclui o cancelado: 100 + 50 + 200 = 350, não 1349.
    expect(within(spentTile!).getByText('R$ 350,00')).toBeInTheDocument()
  })

  it('agrupa pedidos em andamento antes dos anteriores', () => {
    const orders = [
      makeOrder({ id: 'old-1', value: 10, status: 'Entregue', rawStatus: 'DELIVERED' }),
      makeOrder({ id: 'live-1', value: 20, status: 'Confirmado', rawStatus: 'CONFIRMED' }),
    ]

    render(<OrdersScreen {...baseProps} orders={orders} />)

    const inProgressSection = screen.getByRole('region', { name: /pedidos em andamento/i })
    const previousSection = screen.getByRole('region', { name: /pedidos anteriores/i })

    expect(within(inProgressSection).getByText('live-1')).toBeInTheDocument()
    expect(within(previousSection).getByText('old-1')).toBeInTheDocument()
    expect(within(inProgressSection).queryByText('old-1')).not.toBeInTheDocument()
  })

  it('mostra a loja do pedido quando o adaptador resolveu o nome', () => {
    const orders = [makeOrder({ id: 'p1', storeName: 'Mercadinho da Ana' })]

    render(<OrdersScreen {...baseProps} orders={orders} />)

    expect(screen.getByText('Mercadinho da Ana')).toBeInTheDocument()
  })

  it('sem nome de loja resolvido, o card degrada com graça (sem inventar dado)', () => {
    const orders = [makeOrder({ id: 'p1' })]

    render(<OrdersScreen {...baseProps} orders={orders} />)

    expect(screen.getByText('p1')).toBeInTheDocument()
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument()
  })

  it('estado vazio não mostra cards-resumo', () => {
    render(<OrdersScreen {...baseProps} orders={[]} />)

    expect(screen.queryByRole('list', { name: /resumo das compras/i })).not.toBeInTheDocument()
    expect(screen.getByText(/nenhum pedido por aqui/i)).toBeInTheDocument()
  })
})
