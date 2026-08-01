import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'

/** WU-50: painel operacional. Fecha a WU-14 do plano original. */
describe('painel admin', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const enterAsAdmin = () => {
    render(<MarketplaceApp />)
    fireEvent.click(screen.getByRole('button', { name: /entrar como operação/i }))
    // Para operação, o item "Mais" da barra leva ao painel.
    fireEvent.click(screen.getByRole('link', { name: /^mais$/i }))
  }

  const openTab = (name: RegExp) => {
    fireEvent.click(screen.getByRole('tab', { name }))
  }

  describe('controle de acesso', () => {
    it('cliente nao renderiza o painel, mesmo forcando a tela', () => {
      render(<MarketplaceApp />)
      fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))
      fireEvent.click(screen.getByRole('link', { name: /^mais$/i }))

      // Cliente vai ao perfil, nunca ao painel.
      expect(screen.queryByRole('tab', { name: /agentes/i })).not.toBeInTheDocument()
      expect(window.location.pathname).toBe('/perfil')
    })

    it('operacao acessa o painel', () => {
      enterAsAdmin()
      expect(screen.getByRole('tab', { name: /agentes/i })).toBeInTheDocument()
    })
  })

  describe('CRUD de agentes', () => {
    const fillAgent = (overrides: Partial<Record<string, string>> = {}) => {
      fireEvent.change(screen.getByPlaceholderText('Nome'), {
        target: { value: overrides.name ?? 'Carla Nunes' },
      })
      fireEvent.change(screen.getByPlaceholderText('Região'), {
        target: { value: overrides.region ?? 'Zona Oeste' },
      })
      fireEvent.change(screen.getByPlaceholderText('Especialidade'), {
        target: { value: overrides.specialty ?? 'Entregas rápidas' },
      })
      fireEvent.change(screen.getByPlaceholderText('Comissão (%)'), {
        target: { value: overrides.commission ?? '15' },
      })
    }

    it('cria um agente novo', () => {
      enterAsAdmin()
      openTab(/agentes/i)

      fillAgent()
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }))

      expect(screen.getByText('Carla Nunes')).toBeInTheDocument()
    })

    it('nao cria agente sem campos obrigatorios', () => {
      enterAsAdmin()
      openTab(/agentes/i)

      fireEvent.change(screen.getByPlaceholderText('Nome'), { target: { value: 'Sem o resto' } })
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }))

      expect(screen.queryByText('Sem o resto')).not.toBeInTheDocument()
    })

    it('rejeita comissao fora da faixa 0..100', () => {
      enterAsAdmin()
      openTab(/agentes/i)

      fillAgent({ name: 'Comissao Absurda', commission: '150' })
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }))

      expect(screen.queryByText('Comissao Absurda')).not.toBeInTheDocument()
    })

    it('deleta um agente', () => {
      enterAsAdmin()
      openTab(/agentes/i)

      expect(screen.getByText('João Almeida')).toBeInTheDocument()
      const row = screen.getByText('João Almeida').closest('div')?.parentElement as HTMLElement
      fireEvent.click(within(row).getAllByRole('button')[1] as HTMLElement)

      expect(screen.queryByText('João Almeida')).not.toBeInTheDocument()
    })

    it('IDs novos nao colidem com os existentes', () => {
      enterAsAdmin()
      openTab(/agentes/i)

      fillAgent({ name: 'Agente Um' })
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }))
      fillAgent({ name: 'Agente Dois' })
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }))

      expect(screen.getByText('Agente Um')).toBeInTheDocument()
      expect(screen.getByText('Agente Dois')).toBeInTheDocument()
    })
  })

  describe('pedidos', () => {
    it('muda o status de um pedido', () => {
      enterAsAdmin()
      openTab(/pedidos/i)

      const selects = screen.getAllByRole('combobox')
      fireEvent.change(selects[2] as HTMLElement, { target: { value: 'Em rota' } })

      expect((selects[2] as HTMLSelectElement).value).toBe('Em rota')
    })

    it('transicao invalida nao corrompe o pedido', () => {
      enterAsAdmin()
      openTab(/pedidos/i)

      // Pedido 1001 ja esta Entregue: voltar para Processando e invalido.
      const selects = screen.getAllByRole('combobox')
      fireEvent.change(selects[0] as HTMLElement, { target: { value: 'Processando' } })

      expect((selects[0] as HTMLSelectElement).value).toBe('Entregue')
    })
  })

  describe('desempenho', () => {
    it('o ranking ordena por comissao decrescente', () => {
      enterAsAdmin()
      openTab(/desempenho/i)

      const ranking = screen.getByText(/ranking/i).parentElement as HTMLElement
      const rows = within(ranking).getAllByText(/^\d\./)
      expect(rows[0]).toHaveTextContent('Pedro Lima')
    })
  })
})
