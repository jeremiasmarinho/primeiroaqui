import { fireEvent, render, screen } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'

describe('catalogo e busca', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const enterAsClient = () => {
    render(<MarketplaceApp />)
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))
  }

  it('filtra por categoria', () => {
    enterAsClient()
    fireEvent.click(screen.getAllByRole('button', { name: /^farmácia/i })[0])
    expect(screen.getAllByText(/box de cuidados pessoais/i).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/smartwatch fitness/i)).toHaveLength(0)
  })

  it('busca por titulo e por vendedor', () => {
    enterAsClient()
    const input = screen.getByLabelText(/buscar produtos, lojas ou categorias/i)

    fireEvent.change(input, { target: { value: 'smartwatch' } })
    expect(screen.getAllByText(/smartwatch fitness/i).length).toBeGreaterThan(0)

    fireEvent.change(input, { target: { value: 'Mercado Central' } })
    expect(screen.getAllByText(/kit supermercado express/i).length).toBeGreaterThan(0)
  })

  it('busca sem resultado mostra estado vazio', () => {
    enterAsClient()
    fireEvent.change(screen.getByLabelText(/buscar produtos, lojas ou categorias/i), { target: { value: 'produto-inexistente-123' } })
    expect(screen.getByText(/nenhum produto encontrado/i)).toBeInTheDocument()
  })

  it('clique no card abre modal e botao adicionar nao abre modal', () => {
    enterAsClient()

    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0])
    expect(screen.queryByText(/detalhes do produto/i)).not.toBeInTheDocument()

    const catalogTitle = screen.getAllByRole('button', { name: /ventilador de mesa premium/i })[0]
    expect(catalogTitle).toBeTruthy()
    fireEvent.click(catalogTitle)
    expect(screen.getByText(/detalhes do produto/i)).toBeInTheDocument()
  })
})
