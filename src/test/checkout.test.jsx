import { fireEvent, render, screen, within } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'

describe('checkout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const enterAsClient = () => {
    render(<MarketplaceApp />)
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))
  }

  // O carrinho abre pela barra inferior. Buscar dentro da nav evita casar com
  // os botoes "Adicionar X ao carrinho" dos cards, que vem antes no DOM.
  const bottomNav = () => screen.getByRole('navigation', { name: /navegação principal/i })

  const openCart = () => {
    fireEvent.click(within(bottomNav()).getByRole('button', { name: /carrinho/i }))
  }

  const addFirstProduct = () => {
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0])
  }

  it('carrinho vazio nao avanca para entrega', () => {
    enterAsClient()
    openCart()
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    expect(screen.getByRole('heading', { name: /carrinho/i })).toBeInTheDocument()
  })

  it('subtotal atualiza ao adicionar item', () => {
    enterAsClient()

    addFirstProduct()
    expect(within(bottomNav()).getByRole('button', { name: /carrinho — 1 itens/i })).toBeInTheDocument()
  })

  it('exige campos obrigatorios e cep valido', () => {
    enterAsClient()

    addFirstProduct()
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))

    expect(screen.getByText(/preencha nome, endereco, cidade e cep/i)).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByPlaceholderText('Endereço'), { target: { value: 'Rua 1' } })
    fireEvent.change(screen.getByPlaceholderText('Cidade'), { target: { value: 'SP' } })
    fireEvent.change(screen.getByPlaceholderText('CEP'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))

    expect(screen.getByText(/informe um cep valido/i)).toBeInTheDocument()
  })
})
