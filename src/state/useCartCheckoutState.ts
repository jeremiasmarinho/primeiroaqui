import { useReducer, useState } from 'react'

import type { CheckoutStep } from '../components/CartDrawer'
import { readStoredJSON } from '../lib/storage'
import {
  addToCart,
  cartReducer,
  createInitialCartState,
  getCartItemsCount,
  getCartSubtotal,
  removeFromCart,
  setQuantity,
} from './cart'
import { applyCoupon } from './coupons'
import { STORAGE_KEYS } from './session'
import { EMPTY_DELIVERY, normalizeCartItems } from './marketplaceSeed'
import { pushToast } from './useToasts'
import type { DeliveryForm, Product } from '../types'

/** Carrinho, gaveta e formulário de checkout (entrega, cupom, pagamento). */
export function useCartCheckoutState() {
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [cartState, dispatchCart] = useReducer(
    cartReducer,
    createInitialCartState(normalizeCartItems(readStoredJSON<unknown>(STORAGE_KEYS.cart, []))),
  )
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('cart')
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>(EMPTY_DELIVERY)
  const [checkoutError, setCheckoutError] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [couponError, setCouponError] = useState('')
  const [discount, setDiscount] = useState(0)
  const [appliedCoupon, setAppliedCoupon] = useState<string | undefined>(undefined)

  const cartItemsCount = getCartItemsCount(cartState)
  const subtotal = getCartSubtotal(cartState)

  /** Soma `quantity` unidades ao que já existe no carrinho (reducer clampa em 99). */
  const addWithQuantity = (product: Product, quantity: number) => {
    dispatchCart(addToCart(product))
    if (quantity > 1) {
      const existing = cartState.items.find((entry) => entry.product.id === product.id)
      dispatchCart(setQuantity(product.id, (existing?.quantity ?? 0) + quantity))
    }
  }

  const handleAddToCart = (product: Product, quantity = 1) => {
    addWithQuantity(product, quantity)
    setIsCartOpen(true)
    pushToast('Adicionado ao carrinho', 'success')
  }

  /** Comprar agora: adiciona e ja abre o passo de entrega, pulando o carrinho. */
  const handleBuyNow = (product: Product, quantity = 1) => {
    addWithQuantity(product, quantity)
    setCheckoutStep('delivery')
    setIsCartOpen(true)
  }

  const handleApplyCoupon = () => {
    const result = applyCoupon(couponCode, subtotal, new Date())
    if (!result.ok) {
      setCouponError(result.message)
      setDiscount(0)
      setAppliedCoupon(undefined)
      return
    }
    setCouponError('')
    setDiscount(result.discount)
    setAppliedCoupon(result.coupon.code)
  }

  const handleRemoveCoupon = () => {
    setCouponCode('')
    setCouponError('')
    setDiscount(0)
    setAppliedCoupon(undefined)
  }

  return {
    isCartOpen,
    setIsCartOpen,
    cartState,
    dispatchCart,
    checkoutStep,
    setCheckoutStep,
    deliveryForm,
    setDeliveryForm,
    checkoutError,
    setCheckoutError,
    couponCode,
    setCouponCode,
    couponError,
    discount,
    appliedCoupon,
    cartItemsCount,
    subtotal,
    onIncrement: (productId: string) => {
      const item = cartState.items.find((entry) => entry.product.id === productId)
      if (item) dispatchCart(addToCart(item.product))
    },
    onDecrement: (productId: string) => dispatchCart(removeFromCart(productId)),
    onRemove: (productId: string) => dispatchCart(setQuantity(productId, 0)),
    onDeliveryChange: (patch: Partial<DeliveryForm>) => setDeliveryForm((prev) => ({ ...prev, ...patch })),
    handleAddToCart,
    handleBuyNow,
    handleApplyCoupon,
    handleRemoveCoupon,
  }
}
