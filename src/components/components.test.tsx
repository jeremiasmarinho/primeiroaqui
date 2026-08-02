import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

import BottomNav from './BottomNav'
import Countdown from './Countdown'
import FlashDeals from './FlashDeals'
import Price from './Price'
import ProductCard from './ProductCard'
import TopBar from './TopBar'
import BannerCarousel from './BannerCarousel'
import { makeProduct } from '../test/factories'

describe('Price', () => {
  it('mostra reais e centavos separados', () => {
    render(<Price product={makeProduct({ price: 77.9, listPrice: 107.99 })} />)
    expect(screen.getByText('90')).toBeInTheDocument()
  })

  it('mostra o preco de lista riscado quando ha desconto', () => {
    render(<Price product={makeProduct({ price: 77.9, listPrice: 107.99 })} />)
    expect(screen.getByText(/107,99/)).toBeInTheDocument()
  })

  it('omite preco de lista e desconto quando listPrice <= price', () => {
    render(<Price product={makeProduct({ price: 100, listPrice: 100 })} />)
    expect(screen.queryByText(/% OFF/)).not.toBeInTheDocument()
  })

  it('arredonda o percentual de desconto', () => {
    render(<Price product={makeProduct({ price: 77.9, listPrice: 107.99 })} />)
    expect(screen.getByText('28% OFF')).toBeInTheDocument()
  })

  it('expoe o valor completo ao leitor de tela', () => {
    render(<Price product={makeProduct({ price: 77.9, listPrice: 107.99 })} />)
    expect(screen.getByText(/77,90.*28 por cento/)).toBeInTheDocument()
  })
})

describe('ProductCard', () => {
  const product = makeProduct({ id: 42, title: 'Ventilador Silencioso', bestSeller: true })

  it('favoritar alterna aria-pressed e avisa o pai', () => {
    const onToggleFavorite = vi.fn()
    const { rerender } = render(
      <ProductCard product={product} isFavorite={false} onToggleFavorite={onToggleFavorite} />,
    )

    const button = screen.getByRole('button', { name: /salvar ventilador silencioso/i })
    expect(button).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(button)
    expect(onToggleFavorite).toHaveBeenCalledWith(product)

    rerender(<ProductCard product={product} isFavorite onToggleFavorite={onToggleFavorite} />)
    expect(screen.getByRole('button', { name: /remover ventilador/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('adicionar ao carrinho nao navega para o detalhe', () => {
    const onAddToCart = vi.fn()
    render(<ProductCard product={product} onAddToCart={onAddToCart} />)

    fireEvent.click(screen.getByRole('button', { name: /adicionar .* ao carrinho/i }))
    expect(onAddToCart).toHaveBeenCalledWith(product)
    expect(window.location.pathname).not.toBe('/produto/42')
  })

  it('o titulo e um link real para a rota do produto', () => {
    render(<ProductCard product={product} />)

    // Link de verdade: alcancavel por teclado e abre em nova aba com ctrl+clique.
    const link = screen.getByRole('link', { name: 'Ventilador Silencioso' })
    expect(link).toHaveAttribute('href', '/produto/42')
  })

  it('selo "Mais vendido" so aparece com bestSeller', () => {
    const { rerender } = render(<ProductCard product={product} />)
    expect(screen.getByText(/mais vendido/i)).toBeInTheDocument()

    rerender(<ProductCard product={makeProduct({ bestSeller: false })} />)
    expect(screen.queryByText(/mais vendido/i)).not.toBeInTheDocument()
  })

  it('erro de imagem cai no placeholder local, sem laco', () => {
    render(<ProductCard product={product} />)
    const img = screen.getByAltText('Ventilador Silencioso') as HTMLImageElement

    fireEvent.error(img)
    expect(img.src).toMatch(/^data:image\/svg\+xml/)

    const afterFirst = img.src
    fireEvent.error(img)
    expect(img.src).toBe(afterFirst)
  })

  it('imagem prioritaria carrega eager, as demais lazy', () => {
    const { rerender } = render(<ProductCard product={product} priority />)
    expect(screen.getByAltText('Ventilador Silencioso')).toHaveAttribute('loading', 'eager')

    rerender(<ProductCard product={product} priority={false} />)
    expect(screen.getByAltText('Ventilador Silencioso')).toHaveAttribute('loading', 'lazy')
  })
})

describe('Countdown', () => {
  /**
   * `advanceTimersByTime` fora de `act()` avanca o relogio mas nao processa o
   * re-render do React: o teste passaria lendo o valor inicial, sem provar
   * nada. Este helper e obrigatorio em todo avanco de tempo aqui.
   */
  const advance = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms)
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('decrementa a cada segundo', () => {
    render(<Countdown initialSeconds={65} />)
    expect(screen.getByText('05')).toBeInTheDocument()

    advance(5000)
    // 65s - 5s = 60s -> 00:01:00
    expect(screen.getByText(/termina em 1 minutos/i)).toBeInTheDocument()
  })

  it('para em zero e nao fica negativo', () => {
    render(<Countdown initialSeconds={2} />)
    advance(10000)

    expect(screen.getAllByText('00')).toHaveLength(3)
    expect(screen.getByText(/oferta encerrada/i)).toBeInTheDocument()
  })

  it('chama onExpire uma unica vez', () => {
    const onExpire = vi.fn()
    render(<Countdown initialSeconds={1} onExpire={onExpire} />)

    advance(10000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('limpa o intervalo ao desmontar', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = render(<Countdown initialSeconds={60} />)
    unmount()
    expect(clearSpy).toHaveBeenCalled()
  })

  it('resume o tempo em minutos para o leitor de tela', () => {
    render(<Countdown initialSeconds={3900} />)
    expect(screen.getByText(/termina em 1 horas e 5 minutos/i)).toBeInTheDocument()
  })
})

describe('FlashDeals', () => {
  it('inclui apenas produtos com 15% ou mais de desconto', () => {
    const products = [
      makeProduct({ id: 1, title: 'Com desconto alto', price: 50, listPrice: 100 }),
      makeProduct({ id: 2, title: 'Com desconto baixo', price: 95, listPrice: 100 }),
    ]
    render(<FlashDeals products={products} />)

    expect(screen.getByText('Com desconto alto')).toBeInTheDocument()
    expect(screen.queryByText('Com desconto baixo')).not.toBeInTheDocument()
  })

  it('some inteiro quando nenhum produto qualifica', () => {
    render(<FlashDeals products={[makeProduct({ price: 99, listPrice: 100 })]} />)
    expect(screen.queryByText(/ofertas relâmpago/i)).not.toBeInTheDocument()
  })

  it('mostra no maximo 3 ofertas', () => {
    const products = Array.from({ length: 6 }, (_, index) =>
      makeProduct({ id: index + 1, title: `Oferta ${index}`, price: 50, listPrice: 100 }),
    )
    render(<FlashDeals products={products} />)

    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
  })
})

describe('TopBar', () => {
  const baseProps = {
    searchQuery: '',
    onSearchChange: vi.fn(),
    category: 'Tudo' as const,
    onCategoryChange: vi.fn(),
  }

  it('a busca tem label associado, nao so placeholder', () => {
    render(<TopBar {...baseProps} />)
    expect(screen.getByLabelText(/buscar produtos, lojas ou categorias/i)).toBeInTheDocument()
  })

  it('badge de notificacao some com zero', () => {
    const { rerender } = render(<TopBar {...baseProps} notificationCount={0} />)
    expect(screen.getByRole('button', { name: /^notificações$/i })).toBeInTheDocument()

    rerender(<TopBar {...baseProps} notificationCount={3} />)
    expect(screen.getByRole('button', { name: /3 não lidas/i })).toBeInTheDocument()
  })

  it('a categoria ativa marca aria-current', () => {
    render(<TopBar {...baseProps} category="Farmácia" />)
    expect(screen.getByRole('link', { name: 'Farmácia' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('link', { name: 'Casa' })).not.toHaveAttribute('aria-current')
  })

  it('sem sessao, o avatar vira ponto de entrada para login', () => {
    render(<TopBar {...baseProps} isAuthenticated={false} />)
    const entrar = screen.getByRole('link', { name: /entrar ou criar conta/i })
    expect(entrar).toHaveAttribute('href', '/perfil') // profileHref por padrao; AppRouter passa /entrar quando visitante
  })
})

describe('BottomNav', () => {
  it('tem exatamente 5 itens — limite do Material Design', () => {
    render(<BottomNav />)
    expect(within(screen.getByRole('navigation')).getAllByRole('listitem')).toHaveLength(5)
  })

  it('o nome acessivel do carrinho inclui a contagem', () => {
    render(<BottomNav cartCount={3} />)
    expect(screen.getByRole('button', { name: /carrinho — 3 itens/i })).toBeInTheDocument()
  })

  it('sem itens, o carrinho ainda tem nome acessivel', () => {
    render(<BottomNav cartCount={0} />)
    expect(screen.getByRole('button', { name: 'Carrinho' })).toBeInTheDocument()
  })

  it('o item ativo marca aria-current="page"', () => {
    render(<BottomNav active="cart" />)
    expect(screen.getByRole('button', { name: 'Carrinho' })).toHaveAttribute('aria-current', 'page')
  })

  it('sem sessao, o item "Mais" vira "Entrar" e aponta para /entrar', () => {
    render(<BottomNav isAuthenticated={false} />)
    const entrar = screen.getByRole('link', { name: 'Entrar' })
    expect(entrar).toHaveAttribute('href', '/entrar')
    expect(screen.queryByRole('link', { name: 'Mais' })).not.toBeInTheDocument()
  })

  it('autenticado (padrao), o item continua "Mais"', () => {
    render(<BottomNav moreHref="/perfil" />)
    expect(screen.getByRole('link', { name: 'Mais' })).toBeInTheDocument()
  })
})

describe('BannerCarousel', () => {
  it('nao tem autoplay — rotacao automatica exige controle de pausa (WCAG 2.2.2)', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    render(<BannerCarousel />)
    expect(setIntervalSpy).not.toHaveBeenCalled()
    setIntervalSpy.mockRestore()
  })

  it('os indicadores sao botoes alcancaveis, nao divs', () => {
    render(<BannerCarousel />)
    const dots = screen.getAllByRole('button', { name: /ir para o banner/i })
    expect(dots.length).toBeGreaterThan(1)
    dots.forEach((dot) => expect(dot.tagName).toBe('BUTTON'))
  })

  it('cada slide se anuncia com posicao', () => {
    render(<BannerCarousel />)
    expect(screen.getByRole('group', { name: /^1 de \d+:/ })).toBeInTheDocument()
  })
})
