import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import MarketplaceApp from '../MarketplaceApp'
import { seedLoggedInStorage } from './authTestHelpers'
import { db, seedStoreOwner, seedStoreOrder } from './mocks/handlers'

/**
 * Fluxos do lojista: onboarding (BUYER → STORE_OWNER → loja criada) e painel
 * /minha-loja (avançar status de pedido, publicar produto). A API é o fake do
 * MSW (mocks/handlers.ts); o papel real vem sempre do GET /api/me.
 */

const renderAt = (path: string) => {
  window.history.pushState({}, '', path)
  return render(<MarketplaceApp />)
}

describe('onboarding de lojista', () => {
  it('BUYER clica em "Vender no Primeiro Aqui", cadastra o negócio e cai no painel', async () => {
    seedLoggedInStorage()
    renderAt('/perfil')

    fireEvent.click(await screen.findByRole('button', { name: /vender no primeiro aqui/i }))

    // A promoção abre o modal de cadastro do negócio.
    expect(await screen.findByText(/configure seu negócio/i)).toBeInTheDocument()
    expect(db.user.role).toBe('STORE_OWNER')

    fireEvent.change(screen.getByPlaceholderText(/nome do negócio/i), {
      target: { value: 'Padaria do Bairro' },
    })
    fireEvent.click(screen.getByRole('button', { name: /salvar cadastro/i }))

    // Sucesso → navega para /minha-loja com a loja recém-criada.
    expect(await screen.findByRole('heading', { name: /padaria do bairro/i })).toBeInTheDocument()
    expect(db.myStores).toHaveLength(1)
    expect(db.myStores[0]?.description).toBe('Loja local')
  })

  it('STORE_OWNER vê o atalho "Minha loja" no perfil em vez do onboarding', async () => {
    seedStoreOwner()
    seedLoggedInStorage()
    renderAt('/perfil')

    expect(await screen.findByRole('link', { name: /minha loja/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /vender no primeiro aqui/i })).not.toBeInTheDocument()
  })
})

describe('painel /minha-loja', () => {
  it('mostra pedidos recebidos e avança o status pelo botão da próxima etapa', async () => {
    const store = seedStoreOwner()
    seedStoreOrder(store.id, { buyerName: 'João Comprador', status: 'PENDING' })
    seedLoggedInStorage()
    renderAt('/minha-loja')

    expect(await screen.findByText(/joão comprador/i)).toBeInTheDocument()
    // "Aguardando confirmação" também é o rótulo do card de métricas — o que
    // importa aqui é o chip do pedido existir junto com a ação de confirmar.
    expect(screen.getAllByText('Aguardando confirmação').length).toBeGreaterThan(1)

    fireEvent.click(screen.getByRole('button', { name: /confirmar pedido/i }))

    expect(await screen.findByText('Confirmado')).toBeInTheDocument()
    // Próxima ação válida muda junto; cancelar ainda é permitido em CONFIRMED.
    expect(screen.getByRole('button', { name: /iniciar preparação/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar pedido/i })).toBeInTheDocument()
    expect(db.storeOrders[0]?.status).toBe('CONFIRMED')
  })

  it('cancela um pedido pendente', async () => {
    const store = seedStoreOwner()
    seedStoreOrder(store.id, { status: 'PENDING' })
    seedLoggedInStorage()
    renderAt('/minha-loja')

    fireEvent.click(await screen.findByRole('button', { name: /cancelar pedido/i }))

    expect(await screen.findByText('Cancelado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirmar pedido/i })).not.toBeInTheDocument()
  })

  it('publica um produto novo com preço em BRL', async () => {
    seedStoreOwner()
    seedLoggedInStorage()
    renderAt('/minha-loja')

    fireEvent.click(await screen.findByRole('tab', { name: /meus produtos/i }))
    expect(await screen.findByText(/sua vitrine está vazia/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Nome do produto'), { target: { value: 'Pão Francês' } })
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'Padaria' } })
    fireEvent.change(screen.getByLabelText('Preço em reais'), { target: { value: '0,90' } })
    fireEvent.change(screen.getByLabelText('Estoque'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: /^publicar produto$/i }))

    expect(await screen.findByText('Pão Francês')).toBeInTheDocument()
    await waitFor(() => {
      const created = db.products.find((product) => product.title === 'Pão Francês')
      expect(created?.priceCents).toBe(90)
      expect(created?.stock).toBe(100)
    })
  })

  it('preço inválido bloqueia a publicação com mensagem clara', async () => {
    seedStoreOwner()
    seedLoggedInStorage()
    renderAt('/minha-loja')

    fireEvent.click(await screen.findByRole('tab', { name: /meus produtos/i }))
    fireEvent.change(await screen.findByLabelText('Nome do produto'), { target: { value: 'Produto X' } })
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'Casa' } })
    fireEvent.change(screen.getByLabelText('Preço em reais'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: /^publicar produto$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/preço válido/i)
    expect(db.products.some((product) => product.title === 'Produto X')).toBe(false)
  })
})
