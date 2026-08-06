import { fireEvent, screen } from '@testing-library/react'
import { enterAsClient, waitForCatalog } from './authTestHelpers'

describe('catalogo e busca', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('filtra por categoria', async () => {
    enterAsClient()
    await waitForCatalog()

    fireEvent.click(screen.getAllByRole('link', { name: /^farmácia$/i })[0] as HTMLElement)
    expect(screen.getAllByText(/box de cuidados pessoais/i).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/smartwatch fitness/i)).toHaveLength(0)
  })

  it('busca por titulo e por vendedor', async () => {
    enterAsClient()
    await waitForCatalog()
    const input = screen.getByLabelText(/buscar produtos, lojas ou categorias/i)

    fireEvent.change(input, { target: { value: 'smartwatch' } })
    expect(screen.getAllByText(/smartwatch fitness/i).length).toBeGreaterThan(0)

    // Vendedor vem de GET /stores/:id resolvido pelo useRemoteCatalog.
    fireEvent.change(input, { target: { value: 'Mercado Central' } })
    expect(screen.getAllByText(/kit supermercado express/i).length).toBeGreaterThan(0)
  })

  it('busca sem resultado mostra estado vazio', async () => {
    enterAsClient()
    await waitForCatalog()

    fireEvent.change(screen.getByLabelText(/buscar produtos, lojas ou categorias/i), {
      target: { value: 'produto-inexistente-123' },
    })
    expect(screen.getByText(/nenhum produto encontrado/i)).toBeInTheDocument()
  })

  it('clique no card abre tela de produto e botao adicionar nao navega', async () => {
    enterAsClient()
    await waitForCatalog()

    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    expect(screen.queryAllByRole('button', { name: /comprar agora/i })).toHaveLength(0)

    const catalogTitle = screen.getAllByRole('link', { name: /ventilador de mesa premium/i })[0] as HTMLElement
    expect(catalogTitle).toBeTruthy()
    fireEvent.click(catalogTitle)
    // A tela de produto busca GET /api/products/:id — o botao chega async.
    expect(await screen.findByRole('button', { name: /comprar agora/i })).toBeInTheDocument()
  })
})
