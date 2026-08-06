import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'
import { seedLoggedInStorage } from './authTestHelpers'
import { db, seedAdmin, seedAdminOrder, seedAdminStore } from './mocks/handlers'

/**
 * Painel admin da plataforma (/admin) sobre a API real (fake do MSW).
 * O papel ADMIN vem sempre do GET /api/me — `seedAdmin()` eleva o usuário do
 * mock; papel gravado no client nunca concede o painel (regressão B5).
 */

const renderAt = (path: string) => {
  window.history.pushState({}, '', path)
  return render(<MarketplaceApp />)
}

describe('painel admin da plataforma', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('controle de acesso', () => {
    it('BUYER logado que força /admin vê acesso restrito, sem tabs', async () => {
      seedLoggedInStorage()
      renderAt('/admin')

      expect(await screen.findByText(/acesso restrito/i)).toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /visão geral/i })).not.toBeInTheDocument()
    })

    it('ADMIN real (confirmado pelo /me) acessa o painel', async () => {
      seedAdmin()
      seedLoggedInStorage()
      renderAt('/admin')

      expect(await screen.findByRole('heading', { name: /painel da plataforma/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /visão geral/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /pedidos/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /lojas/i })).toBeInTheDocument()
    })
  })

  describe('visão geral', () => {
    it('renderiza métricas reais: totais, GMV em BRL e distribuição por status', async () => {
      seedAdmin()
      seedLoggedInStorage()
      renderAt('/admin')

      expect(await screen.findByText('Usuários')).toBeInTheDocument()
      expect(screen.getByText('12')).toBeInTheDocument()
      // Lojas ativas / total = 3 / 4.
      expect(screen.getByText('3 / 4')).toBeInTheDocument()
      // GMV 123450 centavos → R$ 1.234,50 (espaço do Intl é non-breaking).
      expect(screen.getByText((text) => text.replace(/ /g, ' ') === 'R$ 1.234,50')).toBeInTheDocument()
      // Distribuição por status com rótulo pt-BR.
      const statusSection = screen.getByRole('region', { name: /pedidos por status/i })
      expect(statusSection).toHaveTextContent('Aguardando confirmação')
      expect(statusSection).toHaveTextContent('Cancelado')
      // Gráfico dos últimos 30 dias presente.
      expect(screen.getByRole('img', { name: /pedidos por dia nos últimos 30 dias/i })).toBeInTheDocument()
    })
  })

  describe('pedidos da plataforma', () => {
    it('lista comprador, loja e valor, e avança o status pela transição válida', async () => {
      seedAdmin()
      seedAdminOrder({ buyerName: 'Maria Compradora', storeName: 'Tech Shop', status: 'PENDING' })
      seedLoggedInStorage()
      renderAt('/admin/orders')

      expect(await screen.findByText('Maria Compradora')).toBeInTheDocument()
      expect(screen.getByText('Tech Shop')).toBeInTheDocument()
      expect(screen.getByText('Aguardando confirmação')).toBeInTheDocument()

      // PENDING → CONFIRMED é a única transição de avanço válida.
      fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }))

      expect(await screen.findByText('Confirmado')).toBeInTheDocument()
      expect(db.adminOrders[0]?.status).toBe('CONFIRMED')
      // Próxima ação segue a máquina: preparar; cancelar ainda vale.
      expect(screen.getByRole('button', { name: /^preparar$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^cancelar$/i })).toBeInTheDocument()
    })

    it('cancela um pedido pendente', async () => {
      seedAdmin()
      seedAdminOrder({ status: 'PENDING' })
      seedLoggedInStorage()
      renderAt('/admin/orders')

      fireEvent.click(await screen.findByRole('button', { name: /^cancelar$/i }))

      expect(await screen.findByText('Cancelado')).toBeInTheDocument()
      expect(db.adminOrders[0]?.status).toBe('CANCELED')
    })

    it('pedido entregue não oferece ação nenhuma', async () => {
      seedAdmin()
      seedAdminOrder({ status: 'DELIVERED' })
      seedLoggedInStorage()
      renderAt('/admin/orders')

      expect(await screen.findByText('Entregue')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^cancelar$/i })).not.toBeInTheDocument()
    })
  })

  describe('moderação de lojas', () => {
    it('lista lojas com dono e contagens, e desativa com confirmação inline (dois cliques)', async () => {
      seedAdmin()
      seedAdminStore({ name: 'Loja Suspeita', ownerName: 'Zé Dono', productCount: 7, orderCount: 2, isActive: true })
      seedLoggedInStorage()
      renderAt('/admin/stores')

      expect(await screen.findByText('Loja Suspeita')).toBeInTheDocument()
      expect(screen.getByText('Zé Dono')).toBeInTheDocument()
      expect(screen.getByText('Ativa')).toBeInTheDocument()

      // Primeiro clique só arma a confirmação, não desativa ainda.
      fireEvent.click(screen.getByRole('button', { name: /desativar loja suspeita/i }))
      expect(db.adminStores[0]?.isActive).toBe(true)
      const confirmButton = await screen.findByRole('button', { name: /confirmar desativação/i })

      // Segundo clique confirma.
      fireEvent.click(confirmButton)

      expect(await screen.findByText('Desativada')).toBeInTheDocument()
      expect(db.adminStores[0]?.isActive).toBe(false)
      // A ação vira reativar — sem confirmação para religar.
      expect(screen.getByRole('button', { name: /reativar loja suspeita/i })).toBeInTheDocument()
    })

    it('não clicar em confirmar não desativa a loja', async () => {
      seedAdmin()
      seedAdminStore({ name: 'Loja Boa', isActive: true })
      seedLoggedInStorage()
      renderAt('/admin/stores')

      fireEvent.click(await screen.findByRole('button', { name: /desativar loja boa/i }))
      await screen.findByRole('button', { name: /confirmar desativação/i })

      expect(screen.getByText('Ativa')).toBeInTheDocument()
      expect(db.adminStores[0]?.isActive).toBe(true)
    })
  })
})
