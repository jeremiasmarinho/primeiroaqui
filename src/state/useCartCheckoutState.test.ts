import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useCartCheckoutState } from './useCartCheckoutState'
import type { Product } from '../types'

const product: Product = {
  id: 'p1',
  title: 'Produto Teste',
  price: 10,
  image: '',
  category: 'Testes',
  arrival: 'Chega amanhã',
  seller: 'Loja Teste',
  storeId: 's1',
} as Product

describe('useCartCheckoutState — comprar agora com quantidade', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('handleBuyNow sem quantidade adiciona 1 e abre o passo de entrega', () => {
    const { result } = renderHook(() => useCartCheckoutState())

    act(() => result.current.handleBuyNow(product))

    expect(result.current.cartState.items).toEqual([{ product, quantity: 1 }])
    expect(result.current.checkoutStep).toBe('delivery')
    expect(result.current.isCartOpen).toBe(true)
  })

  it('handleBuyNow com quantidade 3 adiciona 3 unidades', () => {
    const { result } = renderHook(() => useCartCheckoutState())

    act(() => result.current.handleBuyNow(product, 3))

    expect(result.current.cartState.items).toEqual([{ product, quantity: 3 }])
    expect(result.current.checkoutStep).toBe('delivery')
  })

  it('handleBuyNow soma à quantidade que já estava no carrinho', () => {
    const { result } = renderHook(() => useCartCheckoutState())

    act(() => result.current.handleAddToCart(product, 2))
    act(() => result.current.handleBuyNow(product, 3))

    expect(result.current.cartState.items).toEqual([{ product, quantity: 5 }])
  })

  it('handleAddToCart com quantidade respeita o teto de 99', () => {
    const { result } = renderHook(() => useCartCheckoutState())

    act(() => result.current.handleAddToCart(product, 250))

    expect(result.current.cartState.items).toEqual([{ product, quantity: 99 }])
  })
})
