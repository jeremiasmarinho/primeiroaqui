import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import OrderDetailScreen from '../screens/OrderDetailScreen'
import { makeOrder } from './factories'

/**
 * Tela de detalhe (/pedido/:id) — nasceu do feedback direto do usuário em
 * "Minhas compras" (título UUID cru + cards não clicáveis). Fonte de dados:
 * a mesma lista `orders` do dashboard (GET /me/orders), sem endpoint novo.
 */

describe('OrderDetailScreen', () => {
  it('mostra título formatado (sem UUID cru), loja, itens, total e pagamento', () => {
    const order = makeOrder({
      id: 'cbdfa2d3-aaaa-bbbb-cccc-111122223333',
      value: 129.9,
      status: 'Confirmado',
      storeName: 'Mercadinho da Ana',
      payment: 'Pix',
      paymentStatus: 'PAID',
      createdAt: '2026-08-01T12:00:00.000Z',
      itemLines: [
        { title: 'Ventilador de Mesa', quantity: 2, unitPrice: 49.9, lineTotal: 99.8 },
        { title: 'Whey Concentrado', quantity: 1, unitPrice: 30.1, lineTotal: 30.1 },
      ],
    })

    render(<OrderDetailScreen orderId={order.id} orders={[order]} />)

    expect(screen.getAllByText('Pedido #CBDFA2D3').length).toBeGreaterThan(0)
    expect(screen.queryByText(order.id)).not.toBeInTheDocument()
    expect(screen.getByText('Mercadinho da Ana')).toBeInTheDocument()
    expect(screen.getByText('Ventilador de Mesa')).toBeInTheDocument()
    expect(screen.getByText('Whey Concentrado')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s?129,90/)).toBeInTheDocument()
    expect(screen.getByText('Confirmado')).toBeInTheDocument()
    expect(screen.getByText(/pago/i)).toBeInTheDocument()
  })

  it('pedido presente mostra "Presente para [nome]" e a mensagem (Item 8)', () => {
    const order = makeOrder({
      id: 'gift-order-1',
      isGift: true,
      giftRecipientName: 'Maria Presenteada',
      giftMessage: 'Feliz aniversário!',
    })

    render(<OrderDetailScreen orderId={order.id} orders={[order]} />)

    expect(screen.getByText(/presente para maria presenteada/i)).toBeInTheDocument()
    expect(screen.getByText(/feliz aniversário/i)).toBeInTheDocument()
  })

  it('pedido que não existe (ou não é do usuário — a API só devolve os próprios) mostra "não encontrado"', () => {
    const order = makeOrder({ id: 'meu-pedido' })

    render(<OrderDetailScreen orderId="pedido-de-outro-usuario" orders={[order]} />)

    expect(screen.getByText(/pedido não encontrado/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver minhas compras/i })).toBeInTheDocument()
  })

  it('carregando (sem o pedido ainda) mostra estado de progresso, não "não encontrado"', () => {
    render(<OrderDetailScreen orderId="algum-id" orders={[]} isLoading />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText(/pedido não encontrado/i)).not.toBeInTheDocument()
  })
})
