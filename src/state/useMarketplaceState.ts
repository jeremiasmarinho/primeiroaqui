import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'

import { products } from '../data/catalog'
import { ROUTES } from '../router/routes'
import type { AuthForm } from '../screens/LoginScreen'
import { writeStoredJSON } from '../lib/storage'
import {
  CEP_ERROR_MESSAGE,
  addressToDeliveryPatch,
  formatAddressLine,
  isValidCep,
} from './addresses'
import { clearCart, replaceCart } from './cart'
import { createOrder, createOrderIdGenerator, repeatOrder } from './orders'
import { STORAGE_KEYS, clearSession } from './session'
import { EMPTY_DELIVERY, initialThreads, EMPTY_BUSINESS } from './marketplaceSeed'
import { useSessionState } from './useSessionState'
import { useCatalogState } from './useCatalogState'
import { useCartCheckoutState } from './useCartCheckoutState'
import { useOrdersAdminState } from './useOrdersAdminState'
import { useAddressesState } from './useAddressesState'
import type { Order } from '../types'

/**
 * Estado e handlers do marketplace inteiro: sessão, vitrine, carrinho,
 * checkout e painel admin. `MarketplaceApp` só compõe as telas com o que
 * este hook devolve — nenhuma lógica de negócio mora no componente.
 *
 * Cada fatia de estado mora em seu próprio hook (`useSessionState`,
 * `useCatalogState`, `useCartCheckoutState`, `useOrdersAdminState`); este
 * hook só cuida da persistência e dos fluxos que cruzam fatias (logout,
 * finalizar compra).
 */
export function useMarketplaceState() {
  const [, navigate] = useLocation()

  const session = useSessionState(navigate)
  const catalog = useCatalogState()
  const cartCheckout = useCartCheckoutState()
  const admin = useOrdersAdminState(catalog.addNotification)
  const addresses = useAddressesState()
  const [repeatError, setRepeatError] = useState('')

  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.agents, admin.agents)
  }, [admin.agents])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.orders, admin.orders)
  }, [admin.orders])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.notifications, catalog.notifications)
  }, [catalog.notifications])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.schedule, admin.schedule)
  }, [admin.schedule])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.user, session.authUser)
  }, [session.authUser])

  // Dados que pertencem à pessoa só persistem com sessão ativa: sem isso o
  // carrinho de quem saiu vaza para o próximo login (regressões B3 e B4).
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.cart, session.authUser ? cartCheckout.cartState : null)
  }, [session.authUser, cartCheckout.cartState])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.favorites, session.authUser ? catalog.favorites : null)
  }, [session.authUser, catalog.favorites])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.messages, session.authUser ? catalog.messageThreads : null)
  }, [session.authUser, catalog.messageThreads])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.currentOrder, session.authUser ? admin.currentOrder : null)
  }, [session.authUser, admin.currentOrder])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.business, session.authUser ? admin.businessProfile : null)
  }, [session.authUser, admin.businessProfile])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.addresses, session.authUser ? addresses.addresses : null)
  }, [session.authUser, addresses.addresses])

  const handleLogout = () => {
    clearSession()
    session.setAuthUser(null)
    session.setUserRole('client')
    cartCheckout.dispatchCart(clearCart())
    catalog.setFavorites([])
    catalog.setMessageThreads(initialThreads)
    admin.setBusinessProfile(null)
    admin.setSetupForm(EMPTY_BUSINESS)
    admin.setCurrentOrder(null)
    addresses.setAddresses([])
    addresses.setSelectedAddressId('')
    navigate(ROUTES.login)
  }

  /** Escolher endereço salvo preenche a entrega — o campo segue editável. */
  const handleSelectAddress = (id: string) => {
    const address = addresses.addresses.find((item) => item.id === id)
    if (!address) return

    addresses.setSelectedAddressId(id)
    cartCheckout.setDeliveryForm((prev) => ({ ...prev, ...addressToDeliveryPatch(address) }))
  }

  const handleCartContinue = () => {
    if (cartCheckout.cartItemsCount === 0) return

    // O padrão entra sozinho no primeiro acesso à entrega; se a pessoa já
    // digitou algo, o que ela escreveu vence.
    const suggested = addresses.defaultAddress
    if (suggested && !cartCheckout.deliveryForm.address) {
      addresses.setSelectedAddressId(suggested.id)
      cartCheckout.setDeliveryForm((prev) => ({ ...prev, ...addressToDeliveryPatch(suggested) }))
    }

    cartCheckout.setCheckoutStep('delivery')
  }

  const handleRepeatOrder = (order: Order) => {
    const result = repeatOrder(order, products)
    if (!result.ok) {
      setRepeatError(result.message)
      return
    }

    setRepeatError('')
    cartCheckout.dispatchCart(replaceCart(result.items))
    cartCheckout.setCheckoutStep('cart')
    cartCheckout.setIsCartOpen(true)
  }

  const handleFinalizePurchase = () => {
    const { deliveryForm } = cartCheckout
    if (!deliveryForm.name || !deliveryForm.address || !deliveryForm.city || !deliveryForm.cep) {
      cartCheckout.setCheckoutError('Preencha nome, endereco, cidade e cep.')
      return
    }
    if (!isValidCep(deliveryForm.cep)) {
      cartCheckout.setCheckoutError(CEP_ERROR_MESSAGE)
      return
    }

    cartCheckout.setCheckoutError('')
    const order = createOrder({
      cartState: cartCheckout.cartState,
      delivery: deliveryForm,
      agentName: admin.agents[0]?.name,
      role: session.userRole,
      idGenerator: createOrderIdGenerator(admin.orders),
      discount: cartCheckout.discount,
      couponCode: cartCheckout.appliedCoupon,
    })

    admin.setOrders((prev) => [order, ...prev])
    cartCheckout.dispatchCart(clearCart())
    admin.setCurrentOrder(order)
    catalog.addNotification(
      'Compra confirmada',
      `Pedido ${order.id} confirmado e o rastreio ja foi liberado.`,
      'success',
    )
    cartCheckout.setCheckoutStep('cart')
    cartCheckout.setDeliveryForm(EMPTY_DELIVERY)
    cartCheckout.handleRemoveCoupon()
    cartCheckout.setIsCartOpen(false)
    navigate(ROUTES.order(order.id))
  }

  return {
    // sessão / autenticação
    authUser: session.authUser,
    userRole: session.userRole,
    isDevMode: session.isDevMode,
    authMode: session.authMode,
    onAuthModeChange: session.setAuthMode,
    authForm: session.authForm,
    onAuthFormChange: (patch: Partial<AuthForm>) => session.setAuthForm((prev) => ({ ...prev, ...patch })),
    authError: session.authError,
    onAuthSubmit: session.handleAuthSubmit,
    onQuickLogin: session.handleQuickLogin,
    onLogout: handleLogout,

    // vitrine / busca
    searchQuery: catalog.searchQuery,
    onSearchChange: catalog.setSearchQuery,
    searchInputRef: catalog.searchInputRef,
    favorites: catalog.favorites,
    onToggleFavorite: catalog.toggleFavorite,
    onAddToCart: cartCheckout.handleAddToCart,
    onBuyNow: cartCheckout.handleBuyNow,
    cartCount: cartCheckout.cartItemsCount,
    notificationCount: catalog.notifications.length,
    onOpenCart: () => cartCheckout.setIsCartOpen(true),

    // pedidos e painel admin
    orders: admin.orders,
    currentOrder: admin.currentOrder,
    onRepeatOrder: handleRepeatOrder,
    repeatError,
    agents: admin.agents,
    schedule: admin.schedule,
    metrics: admin.metrics,
    agentForm: admin.agentForm,
    onAgentFormChange: admin.onAgentFormChange,
    onAgentSubmit: admin.onAgentSubmit,
    onAgentReset: admin.onAgentReset,
    onAgentEdit: admin.onAgentEdit,
    onAgentDelete: admin.onAgentDelete,
    onStatusChange: admin.onStatusChange,
    businessProfile: admin.businessProfile,

    // cadastro do negócio
    isSetupOpen: admin.isSetupOpen,
    setupForm: admin.setupForm,
    onSetupFormChange: admin.onSetupFormChange,
    onBusinessSetupSubmit: admin.onBusinessSetupSubmit,
    onSetupClose: admin.onSetupClose,

    // carrinho e checkout
    isCartOpen: cartCheckout.isCartOpen,
    checkoutStep: cartCheckout.checkoutStep,
    cartState: cartCheckout.cartState,
    deliveryForm: cartCheckout.deliveryForm,
    checkoutError: cartCheckout.checkoutError,
    couponCode: cartCheckout.couponCode,
    couponError: cartCheckout.couponError,
    discount: cartCheckout.discount,
    onCartClose: () => {
      cartCheckout.setIsCartOpen(false)
      cartCheckout.setCheckoutStep('cart')
    },
    onCartIncrement: cartCheckout.onIncrement,
    onCartDecrement: cartCheckout.onDecrement,
    onCartRemove: cartCheckout.onRemove,
    onDeliveryChange: cartCheckout.onDeliveryChange,
    onCouponCodeChange: cartCheckout.setCouponCode,
    onApplyCoupon: cartCheckout.handleApplyCoupon,
    onRemoveCoupon: cartCheckout.handleRemoveCoupon,
    onCartContinue: handleCartContinue,
    onCartConfirm: handleFinalizePurchase,

    // endereços
    addresses: addresses.addresses,
    addressLine: addresses.defaultAddress ? formatAddressLine(addresses.defaultAddress) : '',
    addressForm: addresses.addressForm,
    addressError: addresses.addressError,
    onAddressFormChange: addresses.onAddressFormChange,
    onAddressSubmit: addresses.onAddressSubmit,
    onSetDefaultAddress: addresses.onSetDefaultAddress,
    onRemoveAddress: addresses.onRemoveAddress,
    selectedAddressId: addresses.selectedAddressId,
    onSelectAddress: handleSelectAddress,
  }
}
