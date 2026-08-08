import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import MarketplaceApp from '../MarketplaceApp'
import ProductModal from '../components/ProductModal'
import TrackingScreen from '../screens/TrackingScreen'
import ProfileScreen from '../screens/ProfileScreen'
import { makeOrder, makeProduct, makeUser } from './factories'

describe('ProductModal', () => {
  it('nao renderiza nada sem produto', () => {
    const { container } = render(
      <ProductModal product={null} onClose={vi.fn()} onAddToCart={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra desconto, prazo e loja do vendedor', () => {
    render(
      <ProductModal
        product={makeProduct({ id: '1', price: 50, listPrice: 100, seller: 'Loja Vizinhança' })}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
      />,
    )

    expect(screen.getByText('50% OFF')).toBeInTheDocument()
    expect(screen.getByText(/Loja Vizinhança/)).toBeInTheDocument()
  })

  it('adicionar ao carrinho fecha o modal', () => {
    const onClose = vi.fn()
    const onAddToCart = vi.fn()
    const product = makeProduct({ id: '1' })

    render(<ProductModal product={product} onClose={onClose} onAddToCart={onAddToCart} />)
    fireEvent.click(screen.getByRole('button', { name: /adicionar ao carrinho/i }))

    expect(onAddToCart).toHaveBeenCalledWith(product)
    expect(onClose).toHaveBeenCalled()
  })

  it('produto sem avaliacao mostra estado vazio, nao lista quebrada', () => {
    render(
      <ProductModal product={makeProduct({ id: '9999' })} onClose={vi.fn()} onAddToCart={vi.fn()} />,
    )
    expect(screen.getByText(/ainda não tem avaliações/i)).toBeInTheDocument()
  })

  it('a media exibida bate com as avaliacoes listadas', () => {
    // Produto 1 tem avaliacoes 5, 5 e 4 -> media 4.7
    render(
      <ProductModal product={makeProduct({ id: '1' })} onClose={vi.fn()} onAddToCart={vi.fn()} />,
    )

    const section = screen.getByRole('region', { name: /avaliações/i })
    expect(within(section).getByText('4.7')).toBeInTheDocument()
    expect(within(section).getAllByRole('listitem')).toHaveLength(3)
  })
})

describe('TrackingScreen', () => {
  it('sem pedido, mostra estado vazio com saida', () => {
    const onBack = vi.fn()
    render(<TrackingScreen currentOrder={null} onBack={onBack} />)

    expect(screen.getByText(/nenhum pedido em andamento/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /voltar as ofertas/i }))
    expect(onBack).toHaveBeenCalled()
  })

  it('com pedido, mostra id, valor e status', () => {
    render(
      <TrackingScreen
        currentOrder={makeOrder({ id: '1042', value: 250, status: 'Em rota' })}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByText('1042')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s?250,00/)).toBeInTheDocument()
    expect(screen.getByText('Em rota')).toBeInTheDocument()
  })

  it('lista os itens quando o pedido tem itens', () => {
    render(
      <TrackingScreen
        currentOrder={makeOrder({ items: ['Ventilador', 'Whey'] })}
        onBack={vi.fn()}
      />,
    )
    expect(screen.getByText('Ventilador, Whey')).toBeInTheDocument()
  })
})

describe('ProfileScreen', () => {
  const baseProps = {
    authUser: makeUser({ name: 'Ana Paula', email: 'ana@teste.com' }),
    onAuthUserChange: vi.fn(),
    userRole: 'BUYER' as const,
    businessProfile: null,
    favorites: [],
    orders: [],
    onBack: vi.fn(),
    onLogout: vi.fn(),
    onToggleFavorite: vi.fn(),
    onBecomeStoreOwner: vi.fn(),
  }

  it('mostra dados da conta', () => {
    render(<ProfileScreen {...baseProps} />)
    expect(screen.getByText('Ana Paula')).toBeInTheDocument()
    expect(screen.getByText('ana@teste.com')).toBeInTheDocument()
  })

  it('sem favoritos, mostra estado vazio', () => {
    render(<ProfileScreen {...baseProps} />)
    expect(screen.getByText(/nenhum favorito salvo/i)).toBeInTheDocument()
  })

  it('remover favorito avisa o pai', () => {
    const onToggleFavorite = vi.fn()
    const product = makeProduct({ id: '7', title: 'Salvo' })

    render(
      <ProfileScreen {...baseProps} favorites={[product]} onToggleFavorite={onToggleFavorite} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /remover/i }))

    expect(onToggleFavorite).toHaveBeenCalledWith(product)
  })

  it('lista os pedidos mais recentes', () => {
    render(
      <ProfileScreen
        {...baseProps}
        orders={[makeOrder({ id: '2001' }), makeOrder({ id: '2002' })]}
      />,
    )
    expect(screen.getByText('Pedido #2001')).toBeInTheDocument()
    expect(screen.getByText('Pedido #2002')).toBeInTheDocument()
  })

  it('sair da conta dispara o logout', () => {
    const onLogout = vi.fn()
    render(<ProfileScreen {...baseProps} onLogout={onLogout} />)
    fireEvent.click(screen.getByRole('button', { name: /sair da conta/i }))
    expect(onLogout).toHaveBeenCalled()
  })
})

describe('LoginScreen — validacao', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/entrar')
  })

  const submit = () => {
    const password = screen.getByLabelText('Senha')
    fireEvent.submit(password.closest('form') as HTMLFormElement)
  }

  it('mostra o erro dentro do formulario, perto do campo', () => {
    render(<MarketplaceApp />)
    fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'invalido' } })
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: '123456' } })
    submit()

    const error = screen.getByText(/informe um e-mail valido/i)
    expect(error.closest('form')).toBeTruthy()
  })

  it('alterna entre entrar e criar conta, revelando o campo nome', () => {
    render(<MarketplaceApp />)
    expect(screen.queryByPlaceholderText('Seu nome')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }))
    expect(screen.getByPlaceholderText('Seu nome')).toBeInTheDocument()
  })
})
