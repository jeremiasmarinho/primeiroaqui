export const createInitialCartState = (initialItems = []) => ({
  items: Array.isArray(initialItems) ? initialItems : [],
})

export const addToCart = (product) => ({
  type: 'ADD_TO_CART',
  payload: product,
})

export const removeFromCart = (productId) => ({
  type: 'REMOVE_FROM_CART',
  payload: productId,
})

export const clearCart = () => ({
  type: 'CLEAR_CART',
})

export const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const product = action.payload
      const existingIndex = state.items.findIndex((item) => item.product.id === product.id)

      if (existingIndex === -1) {
        return {
          ...state,
          items: [...state.items, { product, quantity: 1 }],
        }
      }

      return {
        ...state,
        items: state.items.map((item, index) =>
          index === existingIndex ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      }
    }

    case 'REMOVE_FROM_CART': {
      const productId = action.payload
      return {
        ...state,
        items: state.items
          .map((item) => {
            if (item.product.id !== productId) return item
            if (item.quantity <= 1) return null
            return { ...item, quantity: item.quantity - 1 }
          })
          .filter(Boolean),
      }
    }

    case 'CLEAR_CART':
      return createInitialCartState()

    default:
      return state
  }
}

export const getCartSubtotal = (state) =>
  state.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

export const getCartItemsCount = (state) =>
  state.items.reduce((sum, item) => sum + item.quantity, 0)
