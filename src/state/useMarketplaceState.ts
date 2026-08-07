import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'wouter'

import { ROUTES, toCategorySlug } from '../router/routes'
import type { AuthForm } from '../screens/LoginScreen'
import { writeStoredJSON } from '../lib/storage'
import { api, ApiError, loadStoredSession, setOnUnauthorized } from '../lib/api'
import { favoriteToViewProduct, toViewOrder } from '../lib/adapters'
import { clearCart, replaceCart } from './cart'
import { repeatOrder } from './orders'
import { STORAGE_KEYS, clearSession } from './session'
import { pendingIntentMessage } from './pendingIntent'
import { EMPTY_DELIVERY, initialThreads, EMPTY_BUSINESS } from './marketplaceSeed'
import { useSessionState } from './useSessionState'
import { useCatalogState } from './useCatalogState'
import { useRemoteCatalog } from './useRemoteCatalog'
import { useCartCheckoutState } from './useCartCheckoutState'
import { useBusinessSetupState } from './useBusinessSetupState'
import { useAddressesState } from './useAddressesState'
import { CEP_ERROR_MESSAGE, formatAddressLine, isValidCep } from './addresses'
import type { Order, Product, Role } from '../types'

/**
 * Estado e handlers do marketplace inteiro: sessão, vitrine, carrinho,
 * checkout e painel admin. `MarketplaceApp` só compõe as telas com o que
 * este hook devolve — nenhuma lógica de negócio mora no componente.
 *
 * Fase de integração: catálogo, sessão, favoritos, endereços e pedidos agora
 * vêm da API real (`src/lib/api.ts`). O painel admin e o rastreio seguem
 * mock — outra fase cuida deles.
 */
export function useMarketplaceState() {
  const [location, navigate] = useLocation()

  const catalog = useCatalogState()
  const remoteCatalog = useRemoteCatalog()
  const cartCheckout = useCartCheckoutState()
  // Fecha a gaveta do carrinho antes de qualquer redirecionamento para
  // /entrar: veja o comentário de `onBeforeRedirect` em useSessionState.
  const session = useSessionState(navigate, () => cartCheckout.setIsCartOpen(false))
  const admin = useBusinessSetupState()
  const addresses = useAddressesState(!!session.authUser)
  const [repeatError, setRepeatError] = useState('')

  // ------------------------------------------------------------------
  // Pedidos reais (GET /api/me/orders)
  // ------------------------------------------------------------------
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [ordersReloadKey, setOrdersReloadKey] = useState(0)

  const hasSession = !!session.authUser

  useEffect(() => {
    if (!hasSession || !loadStoredSession()) {
      setMyOrders([])
      return
    }
    let cancelled = false
    setOrdersLoading(true)
    setOrdersError('')
    api
      .listMyOrders()
      .then(({ orders }) => {
        if (cancelled) return
        const titleById = new Map(
          remoteCatalog.products.map((product) => [product.id, product.title]),
        )
        setMyOrders(orders.map((order) => toViewOrder(order, titleById)))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setOrdersError(
          err instanceof ApiError && err.status > 0
            ? err.message
            : 'Não foi possível carregar seus pedidos.',
        )
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false)
      })
    return () => {
      cancelled = true
    }
    // remoteCatalog.products só melhora os títulos exibidos; recarregar a cada
    // mudança do catálogo seria requisição à toa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession, ordersReloadKey])

  // ------------------------------------------------------------------
  // Favoritos reais (GET /api/me/favorites): hidrata a fatia local.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!hasSession || !loadStoredSession()) return
    let cancelled = false
    api
      .listFavorites()
      .then(({ products }) => {
        if (!cancelled) catalog.setFavorites(products.map(favoriteToViewProduct))
      })
      .catch(() => {
        // Silencioso: favoritos são conveniência; a lista local segue como cache.
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession])

  // ------------------------------------------------------------------
  // Sessão derrubada (logout ou 401): limpar tudo que é da pessoa.
  // ------------------------------------------------------------------
  const dropLocalSession = useCallback(() => {
    clearSession()
    session.setAuthUser(null)
    session.setUserRole('BUYER')
    cartCheckout.dispatchCart(clearCart())
    catalog.setFavorites([])
    catalog.setMessageThreads(initialThreads)
    admin.setBusinessProfile(null)
    admin.setSetupForm(EMPTY_BUSINESS)
    admin.setCurrentOrder(null)
    addresses.setAddresses([])
    addresses.setSelectedAddressId('')
    setMyOrders([])
    // Setters de useState são estáveis; os hooks de fatia não mudam entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setOnUnauthorized(() => dropLocalSession())
    return () => setOnUnauthorized(null)
  }, [dropLocalSession])

  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.notifications, catalog.notifications)
  }, [catalog.notifications])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.user, session.authUser)
  }, [session.authUser])

  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.cart, cartCheckout.cartState)
  }, [cartCheckout.cartState])
  // Favoritos persistem como cache apenas com sessão ativa: sem isso, os
  // favoritos de quem saiu vazam para o próximo login (regressões B3 e B4).
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

  const handleLogout = () => {
    // Invalida o token no servidor; o estado local cai mesmo se a rede falhar.
    if (loadStoredSession()) {
      api.logout().catch(() => {})
    }
    dropLocalSession()
    navigate(ROUTES.login)
  }

  /** Escolher endereço salvo preenche a entrega — o campo segue editável. */
  const handleSelectAddress = (id: string) => {
    const address = addresses.addresses.find((item) => item.id === id)
    if (!address) return

    addresses.setSelectedAddressId(id)
    cartCheckout.setDeliveryForm((prev) => ({
      ...prev,
      address: address.street,
      city: address.city,
      cep: address.cep,
    }))
  }

  const handleCartContinue = () => {
    if (cartCheckout.cartItemsCount === 0) return

    // O padrão entra sozinho no primeiro acesso à entrega; se a pessoa já
    // escolheu outro endereço, a escolha dela vence.
    const suggested = addresses.defaultAddress
    if (suggested && !addresses.selectedAddressId) {
      handleSelectAddress(suggested.id)
    }

    cartCheckout.setCheckoutStep('delivery')
  }

  /**
   * Otimista: a UI muda na hora e a API confirma atrás. Se a chamada falhar,
   * reverte e avisa — coração que "desmarca sozinho" sem explicação é bug.
   */
  const toggleFavoriteWithApi = (product: Product) => {
    const wasFavorite = catalog.favorites.some((item) => item.id === product.id)
    catalog.toggleFavorite(product)

    const call = wasFavorite ? api.removeFavorite(product.id) : api.addFavorite(product.id)
    call.catch((err: unknown) => {
      catalog.toggleFavorite(product)
      catalog.addNotification(
        'Favoritos',
        err instanceof ApiError && err.status > 0
          ? err.message
          : 'Não foi possível atualizar seus favoritos.',
        'warning',
      )
    })
  }

  const guardedToggleFavorite = (product: Product) => {
    if (!session.authUser) {
      session.redirectToLogin(location, { type: 'favorite', productId: product.id })
      return
    }
    toggleFavoriteWithApi(product)
  }

  const guardedCartContinue = () => {
    if (cartCheckout.cartItemsCount === 0) return
    if (!session.authUser) {
      // Fechamento da gaveta: ver onBeforeRedirect em redirectToLogin.
      session.redirectToLogin(location, { type: 'resume-checkout' })
      return
    }
    handleCartContinue()
  }

  const guardedBuyNow = (product: Product) => {
    if (!session.authUser) {
      cartCheckout.handleAddToCart(product)
      session.redirectToLogin(location, { type: 'resume-checkout' })
      return
    }
    cartCheckout.handleBuyNow(product)
  }

  /** Roda depois de login/cadastro bem-sucedido: resolve a intenção pendente e volta para onde a pessoa estava. */
  const resolvePendingLoginAndNavigate = () => {
    const intent = session.pendingIntent
    if (intent?.type === 'favorite') {
      const product = remoteCatalog.products.find((item) => item.id === intent.productId)
      if (product) toggleFavoriteWithApi(product)
    } else if (intent?.type === 'resume-checkout') {
      handleCartContinue()
      cartCheckout.setIsCartOpen(true)
    }
    navigate(session.pendingReturnTo ?? ROUTES.home)
    session.clearPendingLogin()
  }

  const onAuthSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    void session.handleAuthSubmit(event).then((success) => {
      if (success) resolvePendingLoginAndNavigate()
    })
  }

  const onQuickLogin = (role: Role) => {
    session.handleQuickLogin(role)
    resolvePendingLoginAndNavigate()
  }

  // ------------------------------------------------------------------
  // Onboarding de lojista
  // ------------------------------------------------------------------

  /**
   * "Vender no Primeiro Aqui": promove BUYER→STORE_OWNER no servidor (rota
   * idempotente, sem input — o papel nunca sai do cliente) e abre o cadastro
   * do negócio.
   */
  const handleBecomeStoreOwner = async () => {
    try {
      const { user } = await api.becomeStoreOwner()
      session.setAuthUser({ id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl })
      session.setUserRole(user.role)
      admin.setIsSetupOpen(true)
    } catch (err) {
      catalog.addNotification(
        'Cadastro de lojista',
        err instanceof ApiError && err.status > 0
          ? err.message
          : 'Não foi possível iniciar seu cadastro de lojista. Tente novamente.',
        'warning',
      )
    }
  }

  /**
   * Cadastro do negócio ligado ao POST /api/stores real. Decisões:
   * - `categoria` do modal (um valor de `StoreCategory`, ver
   *   src/lib/storeCategory.ts) vai como `category` da loja;
   * - endereço/telefone do modal ficam só no perfil local (businessProfile)
   *   até o backend ter esses campos;
   * - lat/lng vão como 0 por ora (geolocalização é outra fase);
   * - slug derivado do nome; colisão (409) tenta uma vez com sufixo único.
   */
  const handleBusinessSetupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = admin.setupForm.name.trim()
    if (!name) return

    const baseSlug = toCategorySlug(name) || 'minha-loja'
    const create = (slug: string) =>
      api.createStore({
        name,
        slug,
        latitude: 0,
        longitude: 0,
        category: admin.setupForm.category || undefined,
      })

    try {
      let created
      try {
        created = await create(baseSlug)
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          created = await create(`${baseSlug}-${Date.now().toString(36)}`)
        } else {
          throw err
        }
      }
      admin.setBusinessProfile({ ...admin.setupForm, name: created.store.name })
      admin.setIsSetupOpen(false)
      catalog.addNotification(
        'Loja criada',
        `${created.store.name} já está no Primeiro Aqui. Publique seus produtos!`,
        'success',
      )
      navigate(ROUTES.myStore)
    } catch (err) {
      catalog.addNotification(
        'Cadastro do negócio',
        err instanceof ApiError && err.status > 0
          ? err.message
          : 'Não foi possível criar sua loja. Tente novamente.',
        'warning',
      )
    }
  }

  const handleRepeatOrder = (order: Order) => {
    const result = repeatOrder(order, remoteCatalog.products)
    if (!result.ok) {
      setRepeatError(result.message)
      return
    }

    setRepeatError('')
    cartCheckout.dispatchCart(replaceCart(result.items))
    cartCheckout.setCheckoutStep('cart')
    cartCheckout.setIsCartOpen(true)
  }

  /**
   * Checkout real: POST /api/orders com os itens do carrinho e o endereço
   * salvo escolhido. O backend valida estoque e preço; os erros discriminados
   * (409 estoque, 404 produto) viram mensagens específicas aqui.
   */
  const handleFinalizePurchase = async () => {
    if (cartCheckout.cartItemsCount === 0) return

    if (!cartCheckout.deliveryForm.name) {
      cartCheckout.setCheckoutError('Informe o nome de quem recebe a entrega.')
      return
    }
    // O CEP digitado é só informativo (o endereço real vai por addressId),
    // mas CEP visivelmente errado ainda merece correção antes do pedido.
    if (cartCheckout.deliveryForm.cep && !isValidCep(cartCheckout.deliveryForm.cep)) {
      cartCheckout.setCheckoutError(CEP_ERROR_MESSAGE)
      return
    }
    const addressId = addresses.selectedAddressId || addresses.defaultAddress?.id
    if (!addressId) {
      cartCheckout.setCheckoutError('Cadastre e selecione um endereço de entrega para finalizar.')
      return
    }

    cartCheckout.setCheckoutError('')
    try {
      const { orders } = await api.createOrder({
        items: cartCheckout.cartState.items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        addressId,
      })

      const titleById = new Map(
        remoteCatalog.products.map((product) => [product.id, product.title]),
      )
      setMyOrders((prev) => [...orders.map((order) => toViewOrder(order, titleById)), ...prev])
      cartCheckout.dispatchCart(clearCart())
      catalog.addNotification(
        'Compra confirmada',
        orders.length > 1
          ? `Seus ${orders.length} pedidos foram confirmados (um por loja).`
          : 'Pedido confirmado! Acompanhe em Meus pedidos.',
        'success',
      )
      cartCheckout.setCheckoutStep('cart')
      cartCheckout.setDeliveryForm(EMPTY_DELIVERY)
      cartCheckout.handleRemoveCoupon()
      cartCheckout.setIsCartOpen(false)
      setOrdersReloadKey((key) => key + 1)
      navigate(ROUTES.orders)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Estoque acabou entre o carrinho e o checkout: recarrega o catálogo
        // para os cards refletirem o estoque real.
        remoteCatalog.retry()
        cartCheckout.setCheckoutError(
          'Um ou mais itens do carrinho ficaram sem estoque. Ajuste as quantidades e tente de novo.',
        )
        return
      }
      if (err instanceof ApiError && err.status === 404) {
        cartCheckout.setCheckoutError(
          'Um dos produtos do carrinho saiu do catálogo. Remova-o para continuar.',
        )
        return
      }
      cartCheckout.setCheckoutError(
        err instanceof ApiError && err.status > 0
          ? err.message
          : 'Não foi possível finalizar a compra. Verifique sua conexão e tente novamente.',
      )
    }
  }

  return {
    // sessão / autenticação
    authUser: session.authUser,
    onAuthUserChange: session.setAuthUser,
    userRole: session.userRole,
    isDevMode: session.isDevMode,
    authMode: session.authMode,
    onAuthModeChange: session.setAuthMode,
    authForm: session.authForm,
    onAuthFormChange: (patch: Partial<AuthForm>) => session.setAuthForm((prev) => ({ ...prev, ...patch })),
    authError: session.authError,
    authPending: session.authPending,
    onAuthSubmit,
    onQuickLogin,
    onRequireLogin: session.recordReturnTo,
    loginContextMessage: session.resetSuccessMessage || pendingIntentMessage(session.pendingIntent),
    onLogout: handleLogout,
    onBecomeStoreOwner: () => {
      void handleBecomeStoreOwner()
    },
    forgotPasswordOpen: session.forgotPasswordOpen,
    forgotEmail: session.forgotEmail,
    onForgotEmailChange: session.setForgotEmail,
    forgotStatus: session.forgotStatus,
    forgotError: session.forgotError,
    onOpenForgotPassword: session.openForgotPassword,
    onCloseForgotPassword: session.closeForgotPassword,
    onForgotPasswordSubmit: (event: React.FormEvent<HTMLFormElement>) => {
      void session.handleForgotPasswordSubmit(event)
    },
    onPasswordResetSuccess: session.notePasswordResetSuccess,

    // vitrine / busca — catálogo real
    products: remoteCatalog.products,
    productsLoading: remoteCatalog.isLoading,
    productsError: remoteCatalog.error,
    onRetryProducts: remoteCatalog.retry,
    categories: remoteCatalog.categories,
    searchQuery: catalog.searchQuery,
    onSearchChange: catalog.setSearchQuery,
    searchInputRef: catalog.searchInputRef,
    favorites: catalog.favorites,
    onToggleFavorite: guardedToggleFavorite,
    onAddToCart: cartCheckout.handleAddToCart,
    onBuyNow: guardedBuyNow,
    cartCount: cartCheckout.cartItemsCount,
    notifications: catalog.notifications,
    notificationCount: catalog.unreadCount,
    onNotificationsOpen: catalog.markNotificationsRead,
    onOpenCart: () => cartCheckout.setIsCartOpen(true),

    // pedidos reais da pessoa
    orders: myOrders,
    ordersLoading,
    ordersError,
    onRepeatOrder: handleRepeatOrder,
    repeatError,

    // rastreio e perfil do negócio (o painel admin real vive em useAdminDashboard)
    currentOrder: admin.currentOrder,
    businessProfile: admin.businessProfile,

    // cadastro do negócio
    isSetupOpen: admin.isSetupOpen,
    setupForm: admin.setupForm,
    onSetupFormChange: admin.onSetupFormChange,
    onBusinessSetupSubmit: (event: React.FormEvent<HTMLFormElement>) => {
      void handleBusinessSetupSubmit(event)
    },
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
    onCartContinue: guardedCartContinue,
    onCartConfirm: () => {
      void handleFinalizePurchase()
    },

    // endereços reais
    addresses: addresses.addresses,
    addressesLoading: addresses.isLoading,
    addressesError: addresses.loadError,
    onRetryAddresses: addresses.retry,
    addressLine: addresses.defaultAddress ? formatAddressLine(addresses.defaultAddress) : '',
    addressForm: addresses.addressForm,
    addressError: addresses.addressError,
    onAddressFormChange: addresses.onAddressFormChange,
    onAddressSubmit: (event: React.FormEvent<HTMLFormElement>) => {
      void addresses.onAddressSubmit(event)
    },
    selectedAddressId: addresses.selectedAddressId,
    onSelectAddress: handleSelectAddress,
  }
}
