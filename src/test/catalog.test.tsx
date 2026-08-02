import { fireEvent, screen } from '@testing-library/react'
import { enterAsClient } from './authTestHelpers'

describe('catalogo e busca', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('filtra por categoria', () => {
    enterAsClient()
    fireEvent.click(screen.getAllByRole('link', { name: /^farmácia$/i })[0] as HTMLElement as HTMLElement)
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

  it('clique no card abre tela de produto e botao adicionar nao navega', () => {
    enterAsClient()

    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    expect(screen.queryAllByRole('button', { name: /comprar agora/i })).toHaveLength(0)

    const catalogTitle = screen.getAllByRole('link', { name: /ventilador de mesa premium/i })[0] as HTMLElement
    expect(catalogTitle).toBeTruthy()
    fireEvent.click(catalogTitle)
    expect(screen.getByRole('button', { name: /comprar agora/i })).toBeInTheDocument()
  })
})
