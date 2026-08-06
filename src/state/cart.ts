import type { CartAction, CartItem, CartState, Product } from '../types'

export const MAX_QUANTITY_PER_ITEM = 99

export const createInitialCartState = (initialItems: CartItem[] = []): CartState => ({
  items: Array.isArray(initialItems) ? initialItems : [],
})

export const addToCart = (product: Product): CartAction => ({
  type: 'ADD_TO_CART',
  payload: product,
})

export const removeFromCart = (productId: string): CartAction => ({
  type: 'REMOVE_FROM_CART',
  payload: productId,
})

export const setQuantity = (productId: string, quantity: number): CartAction => ({
  type: 'SET_QUANTITY',
  payload: { productId, quantity },
})

/** Troca o carrinho inteiro — usado por "repetir pedido" (WU-48). */
export const replaceCart = (items: CartItem[]): CartAction => ({
  type: 'REPLACE_CART',
  payload: items,
})

export const clearCart = (): CartAction => ({ type: 'CLEAR_CART' })

export const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const product = action.payload
      const existing = state.items.find((item) => item.product.id === product.id)

      if (!existing) {
        return { ...state, items: [...state.items, { product, quantity: 1 }] }
      }

      if (existing.quantity >= MAX_QUANTITY_PER_ITEM) return state

      return {
        ...state,
        items: state.items.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      }
    }

    case 'REMOVE_FROM_CART': {
      const productId = action.payload
      return {
        ...state,
        items: state.items.flatMap((item) => {
          if (item.product.id !== productId) return [item]
          if (item.quantity <= 1) return []
          return [{ ...item, quantity: item.quantity - 1 }]
        }),
      }
    }

    case 'SET_QUANTITY': {
      const { productId, quantity } = action.payload
      if (!Number.isInteger(quantity)) return state

      const clamped = Math.min(quantity, MAX_QUANTITY_PER_ITEM)
      if (clamped <= 0) {
        return { ...state, items: state.items.filter((item) => item.product.id !== productId) }
      }

      return {
        ...state,
        items: state.items.map((item) =>
          item.product.id === productId ? { ...item, quantity: clamped } : item,
        ),
      }
    }

    case 'REPLACE_CART':
      return createInitialCartState(action.payload)

    case 'CLEAR_CART':
      return createInitialCartState()

    default:
      return state
  }
}

export const getCartSubtotal = (state: CartState): number =>
  state.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

export const getCartItemsCount = (state: CartState): number =>
  state.items.reduce((sum, item) => sum + item.quantity, 0)

export const getLineSubtotal = (item: CartItem): number => item.product.price * item.quantity
