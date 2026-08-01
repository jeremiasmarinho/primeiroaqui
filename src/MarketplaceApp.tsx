import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'wouter'

import BusinessSetupModal from './components/BusinessSetupModal'
import CartDrawer, { type CheckoutStep } from './components/CartDrawer'
import AppRouter from './router/AppRouter'
import { ROUTES } from './router/routes'
import type { AuthForm } from './screens/LoginScreen'
import type { AgentForm } from './screens/admin/AgentsTab'
import type { Metric } from './screens/admin/OverviewTab'

import { formatCurrency } from './lib/format'
import { readStoredJSON, writeStoredJSON } from './lib/storage'
import {
  addToCart,
  cartReducer,
  clearCart,
  createInitialCartState,
  getCartItemsCount,
  getCartSubtotal,
  removeFromCart,
  setQuantity,
} from './state/cart'
import { applyCoupon } from './state/coupons'
import { changeOrderStatus, createOrder, createOrderIdGenerator } from './state/orders'
import { STORAGE_KEYS, clearSession } from './state/session'
import type {
  Agent,
  BusinessProfile,
  CartItem,
  Category,
  DeliveryForm,
  Notification,
  Order,
  OrderStatus,
  Product,
  Role,
  ScheduleItem,
  Thread,
  User,
} from './types'

const initialAgents: Agent[] = [
  { id: 1, name: 'João Almeida', region: 'Centro', specialty: 'Entregas urbanas', status: 'Ativo', commission: 12 },
  { id: 2, name: 'Maria Souza', region: 'Zona Norte', specialty: 'Supermercado', status: 'Disponível', commission: 10 },
  { id: 3, name: 'Pedro Lima', region: 'Zona Sul', specialty: 'Farmácia', status: 'Ativo', commission: 13 },
]

const initialOrders: Order[] = [
  { id: '1001', customer: 'Ana Paula', agent: 'João Almeida', value: 199.9, status: 'Entregue', region: 'Centro' },
  { id: '1002', customer: 'Bruno Costa', agent: 'Maria Souza', value: 129.9, status: 'Em rota', region: 'Zona Norte' },
  { id: '1003', customer: 'Cecília Mendes', agent: 'Pedro Lima', value: 84.9, status: 'Processando', region: 'Zona Sul' },
]

const initialNotifications: Notification[] = [
  { id: 1, title: 'Entrega em andamento', message: 'João já saiu da loja com seu pedido.', type: 'info' },
  { id: 2, title: 'Oferta para você', message: 'Frete grátis em produtos da categoria Casa.', type: 'success' },
]

const initialThreads: Thread[] = [
  {
    id: 1,
    participant: 'João Almeida',
    role: 'Agente',
    status: 'Disponível',
    unread: 2,
    messages: [
      { id: 1, text: 'Pedido 1002 saiu da loja e segue para o ponto de encontro.', from: 'agent', time: '14:32' },
      { id: 2, text: 'Estou confirmando o horário de chegada.', from: 'user', time: '14:35' },
    ],
  },
]

const initialSchedule: ScheduleItem[] = [
  { id: 1, title: 'Recolha no Mercado Central', time: '09:00', agent: 'Maria Souza', status: 'Confirmado' },
  { id: 2, title: 'Entrega no Centro', time: '11:30', agent: 'João Almeida', status: 'Em andamento' },
  { id: 3, title: 'Retirada na Farmácia Local', time: '16:15', agent: 'Pedro Lima', status: 'Pendente' },
]

const EMPTY_DELIVERY: DeliveryForm = { name: '', address: '', city: '', cep: '', payment: 'Pix' }
const EMPTY_AGENT_FORM: AgentForm = { id: '', name: '', region: '', specialty: '', status: 'Disponível', commission: '' }
const EMPTY_BUSINESS: BusinessProfile = { name: '', category: 'Loja local', address: '', phone: '' }

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CEP_REGEX = /^\d{5}-?\d{3}$/

/**
 * Papel vem sempre como `client` ao ler o storage. Marcar `admin` à mão no
 * localStorage não concede painel (regressão B5). Enquanto não houver servidor,
 * a operação entra apenas pelo atalho de desenvolvimento.
 */
const normalizeStoredUser = (value: unknown): User | null => {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<User>
  if (typeof candidate.email !== 'string') return null

  return {
    name:
      typeof candidate.name === 'string' && candidate.name.trim()
        ? candidate.name
        : 'Cliente Primeiro Aqui',
    email: candidate.email,
    role: 'client',
  }
}

/** Aceita o formato atual `{items}` e migra o formato antigo (array cru). */
const normalizeCartItems = (stored: unknown): CartItem[] => {
  if (stored && typeof stored === 'object' && Array.isArray((stored as { items?: unknown }).items)) {
    return (stored as { items: CartItem[] }).items
  }
  if (Array.isArray(stored)) {
    return (stored as Product[]).map((product) => ({ product, quantity: 1 }))
  }
  return []
}

export default function MarketplaceApp() {
  const storedUser = normalizeStoredUser(readStoredJSON<unknown>(STORAGE_KEYS.user, null))

  const [isCartOpen, setIsCartOpen] = useState(false)
  const [cartState, dispatchCart] = useReducer(
    cartReducer,
    createInitialCartState(normalizeCartItems(readStoredJSON<unknown>(STORAGE_KEYS.cart, []))),
  )
  const [, navigate] = useLocation()
  const [searchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '')

  // A URL e a fonte de verdade do termo buscado: abrir /busca?q=x por link
  // precisa preencher o campo, senao o deep link mostra resultado sem contexto.
  useEffect(() => {
    setSearchQuery(searchParams.get('q') ?? '')
  }, [searchParams])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [userRole, setUserRole] = useState<Role>(() => storedUser?.role ?? 'client')
  const [agents, setAgents] = useState<Agent[]>(() => readStoredJSON(STORAGE_KEYS.agents, initialAgents))
  const [orders, setOrders] = useState<Order[]>(() => readStoredJSON(STORAGE_KEYS.orders, initialOrders))
  const [agentForm, setAgentForm] = useState<AgentForm>(EMPTY_AGENT_FORM)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(() =>
    readStoredJSON<Order | null>(STORAGE_KEYS.currentOrder, null),
  )
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('cart')
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>(EMPTY_DELIVERY)
  const [checkoutError, setCheckoutError] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [couponError, setCouponError] = useState('')
  const [discount, setDiscount] = useState(0)
  const [appliedCoupon, setAppliedCoupon] = useState<string | undefined>(undefined)
  const [authUser, setAuthUser] = useState<User | null>(storedUser)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authForm, setAuthForm] = useState<AuthForm>({ email: '', password: '', name: '' })
  const [authError, setAuthError] = useState('')
  const [favorites, setFavorites] = useState<Product[]>(() =>
    readStoredJSON<Product[]>(STORAGE_KEYS.favorites, []),
  )
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    readStoredJSON(STORAGE_KEYS.notifications, initialNotifications),
  )
  const [messageThreads, setMessageThreads] = useState<Thread[]>(() =>
    readStoredJSON(STORAGE_KEYS.messages, initialThreads),
  )
  const [schedule] = useState<ScheduleItem[]>(() => readStoredJSON(STORAGE_KEYS.schedule, initialSchedule))
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(() =>
    readStoredJSON<BusinessProfile | null>(STORAGE_KEYS.business, null),
  )
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [setupForm, setSetupForm] = useState<BusinessProfile>(() => businessProfile ?? EMPTY_BUSINESS)

  const isDevMode = import.meta.env.DEV

  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.agents, agents)
  }, [agents])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.orders, orders)
  }, [orders])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.notifications, notifications)
  }, [notifications])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.schedule, schedule)
  }, [schedule])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.user, authUser)
  }, [authUser])

  // Dados que pertencem à pessoa só persistem com sessão ativa: sem isso o
  // carrinho de quem saiu vaza para o próximo login (regressões B3 e B4).
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.cart, authUser ? cartState : null)
  }, [authUser, cartState])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.favorites, authUser ? favorites : null)
  }, [authUser, favorites])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.messages, authUser ? messageThreads : null)
  }, [authUser, messageThreads])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.currentOrder, authUser ? currentOrder : null)
  }, [authUser, currentOrder])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.business, authUser ? businessProfile : null)
  }, [authUser, businessProfile])


  const cartItemsCount = getCartItemsCount(cartState)
  const subtotal = getCartSubtotal(cartState)

  const metrics: Metric[] = useMemo(() => {
    const delivered = orders.filter((order) => order.status === 'Entregue').length
    const revenue = orders.reduce((sum, order) => sum + order.value, 0)
    return [
      { label: 'Pedidos', value: orders.length, accent: 'bg-blue-50 text-blue-700' },
      { label: 'Agentes', value: agents.length, accent: 'bg-amber-50 text-amber-700' },
      { label: 'Entregues', value: delivered, accent: 'bg-green-50 text-green-700' },
      { label: 'Receita', value: formatCurrency(revenue), accent: 'bg-violet-50 text-violet-700' },
    ]
  }, [agents, orders])

  const addNotification = (title: string, message: string, type: Notification['type'] = 'info') => {
    setNotifications((prev) =>
      [{ id: prev.length + 1, title, message, type }, ...prev].slice(0, 4),
    )
  }

  const handleAuthSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!EMAIL_REGEX.test(authForm.email)) {
      setAuthError('Informe um e-mail valido.')
      return
    }
    if (authForm.password.length < 6) {
      setAuthError('Senha deve ter ao menos 6 caracteres.')
      return
    }

    setAuthError('')
    setAuthUser({
      name: authForm.name || 'Cliente Primeiro Aqui',
      email: authForm.email,
      role: 'client',
    })
    setUserRole('client')
    navigate(ROUTES.home)
  }

  const handleQuickLogin = (role: Role) => {
    setUserRole(role)
    setAuthUser({
      name: role === 'admin' ? 'Operador' : 'Cliente',
      email: authForm.email || 'cliente@primeiroaqui.com',
      role,
    })
    navigate(ROUTES.home)
  }

  const handleLogout = () => {
    clearSession()
    setAuthUser(null)
    setUserRole('client')
    dispatchCart(clearCart())
    setFavorites([])
    setMessageThreads(initialThreads)
    setBusinessProfile(null)
    setSetupForm(EMPTY_BUSINESS)
    setCurrentOrder(null)
    navigate(ROUTES.login)
  }

  const handleAddToCart = (product: Product) => {
    dispatchCart(addToCart(product))
    setIsCartOpen(true)
  }

  /** Comprar agora: adiciona e ja abre o passo de entrega, pulando o carrinho. */
  const handleBuyNow = (product: Product) => {
    dispatchCart(addToCart(product))
    setCheckoutStep('delivery')
    setIsCartOpen(true)
  }

  const toggleFavorite = (product: Product) => {
    setFavorites((prev) =>
      prev.some((item) => item.id === product.id)
        ? prev.filter((item) => item.id !== product.id)
        : [...prev, product],
    )
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

  const handleFinalizePurchase = () => {
    if (!deliveryForm.name || !deliveryForm.address || !deliveryForm.city || !deliveryForm.cep) {
      setCheckoutError('Preencha nome, endereco, cidade e cep.')
      return
    }
    if (!CEP_REGEX.test(deliveryForm.cep)) {
      setCheckoutError('Informe um cep valido.')
      return
    }

    setCheckoutError('')
    const order = createOrder({
      cartState,
      delivery: deliveryForm,
      agentName: agents[0]?.name,
      role: userRole,
      idGenerator: createOrderIdGenerator(orders),
      discount,
      couponCode: appliedCoupon,
    })

    setOrders((prev) => [order, ...prev])
    dispatchCart(clearCart())
    setCurrentOrder(order)
    addNotification(
      'Compra confirmada',
      `Pedido ${order.id} confirmado e o rastreio ja foi liberado.`,
      'success',
    )
    setCheckoutStep('cart')
    setDeliveryForm(EMPTY_DELIVERY)
    handleRemoveCoupon()
    setIsCartOpen(false)
    navigate(ROUTES.order(order.id))
  }

  const handleStatusChange = (orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order
        try {
          return changeOrderStatus(order, status)
        } catch {
          // Transição inválida é ignorada: o select não deve corromper o pedido.
          return order
        }
      }),
    )
  }

  const handleAgentSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const commission = Number(agentForm.commission)
    if (!agentForm.name || !agentForm.region || !agentForm.specialty) return
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) return

    if (agentForm.id !== '') {
      const id = Number(agentForm.id)
      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === id
            ? {
                ...agent,
                name: agentForm.name,
                region: agentForm.region,
                specialty: agentForm.specialty,
                status: agentForm.status,
                commission,
              }
            : agent,
        ),
      )
    } else {
      setAgents((prev) => [
        {
          id: prev.reduce((max, agent) => Math.max(max, agent.id), 0) + 1,
          name: agentForm.name,
          region: agentForm.region,
          specialty: agentForm.specialty,
          status: agentForm.status,
          commission,
        },
        ...prev,
      ])
    }
    setAgentForm(EMPTY_AGENT_FORM)
  }

  const handleBusinessSetupSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!setupForm.name || !setupForm.address || !setupForm.phone) return

    setBusinessProfile(setupForm)
    setIsSetupOpen(false)
    addNotification(
      'Cadastro do negocio concluido',
      `${setupForm.name} ja esta disponivel para operacao.`,
      'success',
    )
  }

  return (
    <>
      <AppRouter
        authUser={authUser}
        userRole={userRole}
        isDevMode={isDevMode}
        authMode={authMode}
        onAuthModeChange={setAuthMode}
        authForm={authForm}
        onAuthFormChange={(patch) => setAuthForm((prev) => ({ ...prev, ...patch }))}
        authError={authError}
        onAuthSubmit={handleAuthSubmit}
        onQuickLogin={handleQuickLogin}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchRef={searchInputRef}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
        cartCount={cartItemsCount}
        notificationCount={notifications.length}
        onOpenCart={() => setIsCartOpen(true)}
        orders={orders}
        currentOrder={currentOrder}
        agents={agents}
        schedule={schedule}
        metrics={metrics}
        agentForm={agentForm}
        onAgentFormChange={(patch) => setAgentForm((prev) => ({ ...prev, ...patch }))}
        onAgentSubmit={handleAgentSubmit}
        onAgentReset={() => setAgentForm(EMPTY_AGENT_FORM)}
        onAgentEdit={(agent) => setAgentForm({ ...agent })}
        onAgentDelete={(agentId) => setAgents((prev) => prev.filter((agent) => agent.id !== agentId))}
        onStatusChange={handleStatusChange}
        businessProfile={businessProfile}
      />

      <BusinessSetupModal
        open={isSetupOpen}
        form={setupForm}
        onChange={(patch) => setSetupForm((prev) => ({ ...prev, ...patch }))}
        onSubmit={handleBusinessSetupSubmit}
        onClose={() => setIsSetupOpen(false)}
      />

      <CartDrawer
        open={isCartOpen}
        step={checkoutStep}
        cartState={cartState}
        deliveryForm={deliveryForm}
        checkoutError={checkoutError}
        couponCode={couponCode}
        couponError={couponError}
        discount={discount}
        onClose={() => {
          setIsCartOpen(false)
          setCheckoutStep('cart')
        }}
        onIncrement={(productId) => {
          const item = cartState.items.find((entry) => entry.product.id === productId)
          if (item) dispatchCart(addToCart(item.product))
        }}
        onDecrement={(productId) => dispatchCart(removeFromCart(productId))}
        onRemove={(productId) => dispatchCart(setQuantity(productId, 0))}
        onDeliveryChange={(patch) => setDeliveryForm((prev) => ({ ...prev, ...patch }))}
        onCouponCodeChange={setCouponCode}
        onApplyCoupon={handleApplyCoupon}
        onRemoveCoupon={handleRemoveCoupon}
        onContinue={() => {
          if (cartItemsCount === 0) return
          setCheckoutStep('delivery')
        }}
        onConfirm={handleFinalizePurchase}
      />
    </>
  )
}
