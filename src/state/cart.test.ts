import {
  addToCart,
  cartReducer,
  clearCart,
  createInitialCartState,
  getCartItemsCount,
  getCartSubtotal,
  removeFromCart,
  replaceCart,
  setQuantity,
} from './cart'
import { makeProduct } from '../test/factories'

const productA = makeProduct({ id: 1, title: 'A', price: 10 })
const productB = makeProduct({ id: 2, title: 'B', price: 5 })

describe('cart reducer', () => {
  it('adiciona item novo com quantity 1', () => {
    const state = cartReducer(createInitialCartState(), addToCart(productA))
    expect(state.items).toHaveLength(1)
    expect(state.items[0]).toEqual({ product: productA, quantity: 1 })
  })

  it('adiciona item existente incrementando quantity', () => {
    const state1 = cartReducer(createInitialCartState(), addToCart(productA))
    const state2 = cartReducer(state1, addToCart(productA))
    expect(state2.items).toHaveLength(1)
    expect(state2.items[0]?.quantity).toBe(2)
  })

  it('remove decrementando quantity quando > 1', () => {
    const state1 = cartReducer(createInitialCartState(), addToCart(productA))
    const state2 = cartReducer(state1, addToCart(productA))
    const state3 = cartReducer(state2, removeFromCart(productA.id))
    expect(state3.items).toHaveLength(1)
    expect(state3.items[0]?.quantity).toBe(1)
  })

  it('remove item quando quantity = 1', () => {
    const state1 = cartReducer(createInitialCartState(), addToCart(productA))
    const state2 = cartReducer(state1, removeFromCart(productA.id))
    expect(state2.items).toEqual([])
  })

  it('calcula subtotal com quantity', () => {
    let state = createInitialCartState()
    state = cartReducer(state, addToCart(productA))
    state = cartReducer(state, addToCart(productA))
    state = cartReducer(state, addToCart(productB))
    expect(getCartSubtotal(state)).toBe(25)
  })

  it('subtotal de carrinho vazio e zero', () => {
    expect(getCartSubtotal(createInitialCartState())).toBe(0)
  })

  it('clear esvazia o carrinho', () => {
    let state = createInitialCartState()
    state = cartReducer(state, addToCart(productA))
    state = cartReducer(state, clearCart())
    expect(state.items).toEqual([])
  })

  it('regressao B2: adicionar duas vezes e remover uma vez preserva quantity 1', () => {
    let state = createInitialCartState()
    state = cartReducer(state, addToCart(productA))
    state = cartReducer(state, addToCart(productA))
    state = cartReducer(state, removeFromCart(productA.id))
    expect(getCartItemsCount(state)).toBe(1)
    expect(state.items[0]).toEqual({ product: productA, quantity: 1 })
  })

  it('ignora remocao de produto inexistente', () => {
    const state = cartReducer(createInitialCartState(), removeFromCart(999))
    expect(state.items).toEqual([])
  })

  it('retorna mesmo estado para action desconhecida', () => {
    const state = createInitialCartState()
    const next = cartReducer(state, { type: 'UNKNOWN' } as never)
    expect(next).toBe(state)
  })

  // WU-48 — "repetir pedido" troca o carrinho inteiro de uma vez. Sem esta
  // action seria preciso despachar ADD_TO_CART uma vez por unidade.
  describe('replaceCart', () => {
    it('troca o carrinho inteiro pelos itens informados', () => {
      let state = createInitialCartState()
      state = cartReducer(state, addToCart(productB))
      state = cartReducer(state, replaceCart([{ product: productA, quantity: 3 }]))

      expect(state.items).toEqual([{ product: productA, quantity: 3 }])
      expect(getCartItemsCount(state)).toBe(3)
    })

    it('lista vazia esvazia o carrinho', () => {
      let state = createInitialCartState()
      state = cartReducer(state, addToCart(productA))
      state = cartReducer(state, replaceCart([]))
      expect(state.items).toEqual([])
    })
  })
})
