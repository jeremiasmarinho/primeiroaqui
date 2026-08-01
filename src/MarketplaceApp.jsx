import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  User,
  ShoppingBag,
  Map,
  Bike,
  CheckCircle,
  X,
  Settings,
  Edit,
  Trash2,
} from 'lucide-react'
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
} from './state/cart'
import {
  changeOrderStatus,
  createOrder,
  createOrderIdGenerator,
} from './state/orders'
import { clearSession } from './state/session'

import HomeScreen from './screens/HomeScreen.jsx'
import { products as initialProducts } from './data/catalog.js'

const initialAgents = [
  { id: 1, name: 'João Almeida', region: 'Centro', specialty: 'Entregas urbanas', status: 'Ativo', commission: 12 },
  { id: 2, name: 'Maria Souza', region: 'Zona Norte', specialty: 'Supermercado', status: 'Disponível', commission: 10 },
  { id: 3, name: 'Pedro Lima', region: 'Zona Sul', specialty: 'Farmácia', status: 'Ativo', commission: 13 },
]

const initialOrders = [
  { id: '1001', customer: 'Ana Paula', agent: 'João Almeida', value: 199.9, status: 'Entregue', region: 'Centro' },
  { id: '1002', customer: 'Bruno Costa', agent: 'Maria Souza', value: 129.9, status: 'Em rota', region: 'Zona Norte' },
  { id: '1003', customer: 'Cecília Mendes', agent: 'Pedro Lima', value: 84.9, status: 'Processando', region: 'Zona Sul' },
]

const initialNotifications = [
  { id: 1, title: 'Entrega em andamento', message: 'João já saiu da loja com seu pedido.', type: 'info' },
  { id: 2, title: 'Oferta para você', message: 'Frete grátis em produtos da categoria Casa.', type: 'success' },
]

const initialThreads = [
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
  {
    id: 2,
    participant: 'Maria Souza',
    role: 'Agente',
    status: 'Ativa',
    unread: 1,
    messages: [
      { id: 3, text: 'Temos uma nova rota de supermercado para o bairro.', from: 'agent', time: '13:20' },
    ],
  },
]

const initialSchedule = [
  { id: 1, title: 'Recolha no Mercado Central', time: '09:00', agent: 'Maria Souza', status: 'Confirmado' },
  { id: 2, title: 'Entrega no Centro', time: '11:30', agent: 'João Almeida', status: 'Em andamento' },
  { id: 3, title: 'Retirada na Farmácia Local', time: '16:15', agent: 'Pedro Lima', status: 'Pendente' },
]

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const normalizeStoredUser = (value) => {
  if (!value || typeof value !== 'object') return null
  if (typeof value.email !== 'string') return null

  return {
    name: typeof value.name === 'string' && value.name.trim() ? value.name : 'Cliente Primeiro Aqui',
    email: value.email,
    role: 'client',
  }
}

export default function MarketplaceApp() {
  const storedUser = normalizeStoredUser(readStoredJSON('primeiroaqui_user', null))
  const storedMessages = readStoredJSON('primeiroaqui_messages', initialThreads)
  const storedBusiness = readStoredJSON('primeiroaqui_business', null)
  const storedCurrentOrder = readStoredJSON('primeiroaqui_current_order', null)
  const storedCart = readStoredJSON('primeiroaqui_cart', [])
  const normalizedCartItems = Array.isArray(storedCart?.items)
    ? storedCart.items
    : Array.isArray(storedCart)
      ? storedCart.map((product) => ({ product, quantity: 1 }))
      : []

  const [screen, setScreen] = useState(() => (storedUser ? 'home' : 'login'))
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [cartState, dispatchCart] = useReducer(cartReducer, createInitialCartState(normalizedCartItems))
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)
  const [category, setCategory] = useState('Tudo')
  const [userRole, setUserRole] = useState(() => storedUser?.role || 'client')
  const [adminTab, setAdminTab] = useState('overview')
  const [agents, setAgents] = useState(() => readStoredJSON('primeiroaqui_agents', initialAgents))
  const [orders, setOrders] = useState(() => readStoredJSON('primeiroaqui_orders', initialOrders))
  const [agentForm, setAgentForm] = useState({ id: '', name: '', region: '', specialty: '', status: 'Disponível', commission: '' })
  const [currentOrder, setCurrentOrder] = useState(() => storedCurrentOrder)
  const [checkoutStep, setCheckoutStep] = useState('cart')
  const [deliveryForm, setDeliveryForm] = useState({ name: '', address: '', city: '', cep: '', payment: 'Pix' })
  const [paymentMethod, setPaymentMethod] = useState('Pix')
  const [checkoutError, setCheckoutError] = useState('')
  const [authUser, setAuthUser] = useState(() => storedUser)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' })
  const [authError, setAuthError] = useState('')
  const [favorites, setFavorites] = useState(() => readStoredJSON('primeiroaqui_favorites', []))
  const [notifications, setNotifications] = useState(() => readStoredJSON('primeiroaqui_notifications', initialNotifications))
  const [messageThreads, setMessageThreads] = useState(() => storedMessages)
  const [schedule] = useState(() => readStoredJSON('primeiroaqui_schedule', initialSchedule))
  const [businessProfile, setBusinessProfile] = useState(() => storedBusiness)
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [setupForm, setSetupForm] = useState(() => storedBusiness ?? { name: '', category: 'Loja local', address: '', phone: '' })
  const isDevMode = import.meta.env.DEV

  useEffect(() => {
    writeStoredJSON('primeiroaqui_agents', agents)
  }, [agents])

  useEffect(() => {
    writeStoredJSON('primeiroaqui_orders', orders)
  }, [orders])

  useEffect(() => {
    if (authUser) {
      writeStoredJSON('primeiroaqui_current_order', currentOrder)
      return
    }

    writeStoredJSON('primeiroaqui_current_order', null)
  }, [authUser, currentOrder])

  useEffect(() => {
    if (authUser) {
      writeStoredJSON('primeiroaqui_cart', cartState)
      return
    }

    writeStoredJSON('primeiroaqui_cart', null)
  }, [authUser, cartState])

  useEffect(() => {
    writeStoredJSON('primeiroaqui_user', authUser)
  }, [authUser])

  useEffect(() => {
    if (authUser) {
      writeStoredJSON('primeiroaqui_favorites', favorites)
      return
    }

    writeStoredJSON('primeiroaqui_favorites', null)
  }, [authUser, favorites])

  useEffect(() => {
    writeStoredJSON('primeiroaqui_notifications', notifications)
  }, [notifications])

  useEffect(() => {
    if (authUser) {
      writeStoredJSON('primeiroaqui_messages', messageThreads)
      return
    }

    writeStoredJSON('primeiroaqui_messages', null)
  }, [authUser, messageThreads])

  useEffect(() => {
    writeStoredJSON('primeiroaqui_schedule', schedule)
  }, [schedule])

  useEffect(() => {
    writeStoredJSON('primeiroaqui_business', businessProfile)
  }, [businessProfile])

  const filteredProducts = useMemo(() => {
    return initialProducts.filter((product) => {
      const matchesCategory = category === 'Tudo' || product.category === category
      const query = searchQuery.trim().toLowerCase()
      const matchesQuery = !query || product.title.toLowerCase().includes(query) || product.seller.toLowerCase().includes(query)
      return matchesCategory && matchesQuery
    })
  }, [category, searchQuery])

  const focusSearch = () => {
    searchInputRef.current?.focus()
  }

  const cartItems = cartState.items
  const cartItemsCount = getCartItemsCount(cartState)
  const subtotal = getCartSubtotal(cartState)

  const overviewMetrics = useMemo(() => {
    const delivered = orders.filter((order) => order.status === 'Entregue').length
    const revenue = orders.reduce((sum, order) => sum + order.value, 0)
    return [
      { label: 'Pedidos', value: orders.length, accent: 'bg-blue-50 text-blue-700' },
      { label: 'Agentes', value: agents.length, accent: 'bg-amber-50 text-amber-700' },
      { label: 'Entregues', value: delivered, accent: 'bg-green-50 text-green-700' },
      { label: 'Receita', value: formatCurrency(revenue), accent: 'bg-violet-50 text-violet-700' },
    ]
  }, [agents, orders])

  const handleLogin = (role) => {
    const safeRole = isDevMode && role === 'admin' ? 'admin' : 'client'
    setAuthError('')
    setUserRole(safeRole)
    setAuthUser({ name: safeRole === 'admin' ? 'Operador' : 'Cliente', email: authForm.email || 'cliente@primeiroaqui.com', role: safeRole })
    setScreen('home')
  }

  const handleAuthSubmit = (event) => {
    event.preventDefault()

    if (!authForm.email || !authForm.password) {
      setAuthError('Informe e-mail e senha para continuar.')
      return
    }

    if (!EMAIL_REGEX.test(authForm.email)) {
      setAuthError('Informe um e-mail valido.')
      return
    }

    if (authForm.password.length < 6) {
      setAuthError('Senha deve ter ao menos 6 caracteres.')
      return
    }

    const role = authMode === 'signup' ? 'client' : 'client'
    const nextUser = {
      name: authForm.name || 'Cliente Primeiro Aqui',
      email: authForm.email,
      role,
    }

    setAuthError('')
    setAuthUser(nextUser)
    setUserRole(role)
    setScreen('home')
  }

  const handleOpenProduct = (product) => {
    setSelectedProduct(product)
  }

  const handleAddToCart = (product) => {
    dispatchCart(addToCart(product))
    setIsCartOpen(true)
  }

  const toggleFavorite = (product) => {
    setFavorites((prev) => {
      const exists = prev.some((item) => item.id === product.id)
      return exists ? prev.filter((item) => item.id !== product.id) : [...prev, product]
    })
  }

  const addNotification = (title, message, type = 'info') => {
    setNotifications((prev) => [{ id: Date.now(), title, message, type }, ...prev].slice(0, 4))
  }

  const handleBusinessSetupSubmit = (event) => {
    event.preventDefault()
    if (!setupForm.name || !setupForm.address || !setupForm.phone) return

    const nextProfile = {
      name: setupForm.name,
      category: setupForm.category,
      address: setupForm.address,
      phone: setupForm.phone,
    }

    setBusinessProfile(nextProfile)
    setSetupForm(nextProfile)
    setIsSetupOpen(false)
    addNotification('Cadastro do negócio concluído', `${nextProfile.name} já está disponível para operação.`, 'success')
  }

  const handleRemoveFromCart = (productId) => {
    dispatchCart(removeFromCart(productId))
  }

  const handleCheckout = () => {
    if (!cartItemsCount) return
    setCheckoutError('')
    setCheckoutStep('delivery')
  }

  const handleFinalizePurchase = () => {
    const hasRequiredFields = deliveryForm.name && deliveryForm.address && deliveryForm.city && deliveryForm.cep
    if (!hasRequiredFields) {
      setCheckoutError('Preencha nome, endereco, cidade e CEP para continuar.')
      return
    }

    if (!/^\d{5}-?\d{3}$/.test(deliveryForm.cep.trim())) {
      setCheckoutError('Informe um CEP valido no formato 00000-000.')
      return
    }

    const idGenerator = createOrderIdGenerator(orders)

    try {
      const order = createOrder({
        cartState,
        delivery: deliveryForm,
        agentName: agents[0]?.name,
        role: userRole,
        idGenerator,
      })

      setCheckoutError('')
      setOrders((prev) => [order, ...prev])
      dispatchCart(clearCart())
      setCurrentOrder(order)
      addNotification('Compra confirmada', `Pedido ${order.id} confirmado e o rastreio já foi liberado.`, 'success')
      setCheckoutStep('cart')
      setDeliveryForm({ name: '', address: '', city: '', cep: '', payment: 'Pix' })
      setPaymentMethod('Pix')
      setIsCartOpen(false)
      setScreen('tracking')
    } catch {
      setCheckoutError('Nao foi possivel criar o pedido. Tente novamente.')
    }
  }

  const handleStatusChange = (orderId, status) => {
    setOrders((prev) => prev.map((order) => {
      if (order.id !== orderId) return order

      try {
        return changeOrderStatus(order, status)
      } catch {
        return order
      }
    }))
  }

  const handleLogout = () => {
    clearSession()
    setAuthUser(null)
    setUserRole('client')
    dispatchCart(clearCart())
    setFavorites([])
    setMessageThreads(initialThreads)
    setBusinessProfile(null)
    setSetupForm({ name: '', category: 'Loja local', address: '', phone: '' })
    setCurrentOrder(null)
    setScreen('login')
  }

  const resetAgentForm = () => {
    setAgentForm({ id: '', name: '', region: '', specialty: '', status: 'Disponível', commission: '' })
  }

  const handleAgentSubmit = (event) => {
    event.preventDefault()
    if (!agentForm.name || !agentForm.region || !agentForm.specialty || !agentForm.commission) return

    if (agentForm.id) {
      setAgents((prev) => prev.map((agent) => (agent.id === Number(agentForm.id) ? { ...agent, ...agentForm, commission: Number(agentForm.commission), id: Number(agentForm.id) } : agent)))
    } else {
      const newAgent = {
        id: Date.now(),
        name: agentForm.name,
        region: agentForm.region,
        specialty: agentForm.specialty,
        status: agentForm.status,
        commission: Number(agentForm.commission),
      }
      setAgents((prev) => [newAgent, ...prev])
    }

    resetAgentForm()
  }

  const handleEditAgent = (agent) => {
    setAgentForm({ id: agent.id, name: agent.name, region: agent.region, specialty: agent.specialty, status: agent.status, commission: agent.commission })
    setAdminTab('agents')
  }

  const handleDeleteAgent = (agentId) => {
    setAgents((prev) => prev.filter((agent) => agent.id !== agentId))
  }

  const renderLoginScreen = () => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#ffe600] p-6">
      <div className="w-full max-w-2xl rounded-[32px] bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-4 rounded-[28px] bg-slate-50 p-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-900">Primeiro Aqui</p>
            <p className="text-xs text-slate-500">Marketplace local com operação inteligente</p>
          </div>
        </div>

        <div className="mt-6 rounded-[28px] bg-slate-900 p-6 text-white">
          <h1 className="text-3xl font-black">Gerencie vendas, entregas e agentes em um só lugar</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Uma experiência inspirada no Mercado Livre, pensada para operações locais e crescimento futuro.</p>
        </div>

        <form onSubmit={handleAuthSubmit} className="mt-6 rounded-[28px] border border-slate-200 p-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => setAuthMode('login')} className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${authMode === 'login' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Entrar</button>
            <button type="button" onClick={() => setAuthMode('signup')} className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${authMode === 'signup' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Criar conta</button>
          </div>
          <div className="mt-4 space-y-3">
            {authMode === 'signup' && <input value={authForm.name} onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Seu nome" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />}
            <input value={authForm.email} onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="E-mail" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />
            <input type="password" value={authForm.password} onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))} placeholder="Senha" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />
          </div>
          {authError ? <p className="mt-3 rounded-[14px] bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{authError}</p> : null}
          <button type="submit" className="mt-4 w-full rounded-[20px] bg-slate-900 px-4 py-3 font-bold text-white">{authMode === 'signup' ? 'Criar conta' : 'Entrar'}</button>
        </form>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <button onClick={() => handleLogin('client')} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-left transition hover:-translate-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700"><User className="h-5 w-5" /></div>
              <div>
                <h2 className="font-black text-slate-900">Entrar como cliente</h2>
                <p className="text-sm text-slate-500">Comprar, acompanhar e receber</p>
              </div>
            </div>
          </button>
          {isDevMode ? (
            <button onClick={() => handleLogin('admin')} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-left transition hover:-translate-y-1">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Settings className="h-5 w-5" /></div>
                <div>
                  <h2 className="font-black text-slate-900">Entrar como operação</h2>
                  <p className="text-sm text-slate-500">Painel para agentes e pedidos</p>
                </div>
              </div>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )

  const renderHomeScreen = () => (
    <>
      <HomeScreen
        products={filteredProducts}
        allProducts={initialProducts}
        category={category}
        onCategoryChange={setCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchRef={searchInputRef}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onOpenProduct={handleOpenProduct}
        onAddToCart={handleAddToCart}
        cartCount={cartItemsCount}
        notificationCount={notifications.length}
        userName={authUser?.name}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenProfile={() => setScreen('profile')}
        onNavigate={(id) => {
          if (id === 'categories') focusSearch()
          if (id === 'more') setScreen(userRole === 'admin' ? 'admin' : 'profile')
          if (id === 'videos') setIsSetupOpen(true)
        }}
      />


      {isSetupOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-xl rounded-[28px] bg-white p-4 shadow-2xl md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Cadastro rápido</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">Configure seu negócio</h3>
              </div>
              <button onClick={() => setIsSetupOpen(false)} className="rounded-full bg-slate-100 p-2"><X className="h-5 w-5 text-slate-700" /></button>
            </div>
            <form onSubmit={handleBusinessSetupSubmit} className="mt-4 space-y-3">
              <input value={setupForm.name} onChange={(event) => setSetupForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Nome do negócio" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />
              <select value={setupForm.category} onChange={(event) => setSetupForm((prev) => ({ ...prev, category: event.target.value }))} className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none">
                <option value="Loja local">Loja local</option>
                <option value="Mercado">Mercado</option>
                <option value="Farmácia">Farmácia</option>
                <option value="Serviço">Serviço</option>
              </select>
              <input value={setupForm.address} onChange={(event) => setSetupForm((prev) => ({ ...prev, address: event.target.value }))} placeholder="Endereço" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />
              <input value={setupForm.phone} onChange={(event) => setSetupForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Telefone" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />
              <button type="submit" className="w-full rounded-[20px] bg-slate-900 px-4 py-3 font-bold text-white">Salvar cadastro</button>
            </form>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-4 shadow-2xl md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Detalhes do produto</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">{selectedProduct.title}</h3>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="rounded-full bg-slate-100 p-2"><X className="h-5 w-5 text-slate-700" /></button>
            </div>
            <div className="mt-4 grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
              <img src={selectedProduct.image} alt={selectedProduct.title} className="h-56 w-full rounded-[24px] object-cover" />
              <div>
                <p className="text-sm text-slate-500">{selectedProduct.seller}</p>
                <p className="mt-3 text-3xl font-black text-slate-900">{formatCurrency(selectedProduct.price)}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">Produto com entrega rápida, avaliação excelente e opção de compra segura direto no app.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">{selectedProduct.badge}</span>
                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">{selectedProduct.subtitle}</span>
                </div>
                <div className="mt-5 flex gap-3">
                  <button onClick={() => { handleAddToCart(selectedProduct); setSelectedProduct(null) }} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">Adicionar ao carrinho</button>
                  <button onClick={() => setSelectedProduct(null)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Fechar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="ml-auto flex h-full max-w-md flex-col overflow-hidden rounded-[32px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-gradient-to-r from-slate-950 to-slate-800 p-4 text-white">
              <div>
                <h3 className="font-heading text-lg font-black">{checkoutStep === 'cart' ? 'Carrinho' : 'Entrega'}</h3>
                <p className="text-sm text-slate-300">{checkoutStep === 'cart' ? `${cartItemsCount} itens` : 'Complete os dados para o pedido'}</p>
              </div>
              <button onClick={() => { setIsCartOpen(false); setCheckoutStep('cart') }} className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"><X className="h-5 w-5" /></button>
            </div>

            {checkoutStep === 'cart' ? (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-white to-slate-50 p-4">
                  {cartItemsCount === 0 ? <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">Seu carrinho está vazio.</div> : cartItems.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between rounded-[20px] border border-slate-200/80 bg-white p-3 shadow-sm">
                      <div>
                        <p className="font-heading font-bold text-slate-950">{item.product.title}</p>
                        <p className="text-sm text-slate-500">{formatCurrency(item.product.price)} x {item.quantity}</p>
                      </div>
                      <button onClick={() => handleRemoveFromCart(item.product.id)} className="rounded-full bg-red-50 p-2 text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 bg-white p-4">
                  <div className="rounded-[20px] bg-slate-950 p-4 text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)]">
                    <div className="flex items-center justify-between text-sm text-slate-300"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                    <div className="mt-2 flex items-center justify-between text-sm text-slate-300"><span>Entrega</span><span>Calculada no próximo passo</span></div>
                  </div>
                  <button onClick={handleCheckout} className="mt-3 w-full rounded-[20px] bg-emerald-600 px-4 py-3 font-bold text-white shadow-[0_12px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5">Continuar</button>
                </div>
              </>
            ) : (
              <div className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-white to-slate-50 p-4">
                <div className="rounded-[24px] bg-slate-950 p-4 text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Resumo do pedido</p>
                  <div className="mt-3 flex items-center justify-between text-sm text-slate-300"><span>Itens</span><span>{cartItemsCount}</span></div>
                  <div className="mt-1 flex items-center justify-between text-sm text-slate-300"><span>Total</span><span className="font-black text-white">{formatCurrency(subtotal)}</span></div>
                </div>

                <div className="space-y-3">
                  <input value={deliveryForm.name} onChange={(event) => setDeliveryForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Seu nome" className="w-full rounded-[16px] border border-slate-200 bg-white px-3 py-3 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5" />
                  <input value={deliveryForm.address} onChange={(event) => setDeliveryForm((prev) => ({ ...prev, address: event.target.value }))} placeholder="Endereço" className="w-full rounded-[16px] border border-slate-200 bg-white px-3 py-3 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5" />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={deliveryForm.city} onChange={(event) => setDeliveryForm((prev) => ({ ...prev, city: event.target.value }))} placeholder="Cidade" className="w-full rounded-[16px] border border-slate-200 bg-white px-3 py-3 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5" />
                    <input value={deliveryForm.cep} onChange={(event) => setDeliveryForm((prev) => ({ ...prev, cep: event.target.value }))} placeholder="CEP" className="w-full rounded-[16px] border border-slate-200 bg-white px-3 py-3 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5" />
                  </div>
                  <div className="grid gap-2">
                    {['Pix', 'Cartão', 'Boleto'].map((option) => (
                      <button key={option} type="button" onClick={() => { setPaymentMethod(option); setDeliveryForm((prev) => ({ ...prev, payment: option })) }} className={`rounded-[16px] border px-3 py-3 text-left text-sm font-semibold transition ${paymentMethod === option ? 'border-slate-950 bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                {checkoutError ? (
                  <p className="rounded-[14px] bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{checkoutError}</p>
                ) : null}

                <div className="rounded-[24px] border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                  <p className="font-black">Entrega prevista em até 2 horas</p>
                  <p className="mt-1">Pagamento confirmado via {deliveryForm.payment} após a confirmação.</p>
                </div>

                <button onClick={handleFinalizePurchase} className="w-full rounded-[20px] bg-emerald-600 px-4 py-3 font-bold text-white shadow-[0_12px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5">Confirmar compra</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )

  const renderTrackingScreen = () => (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl rounded-[32px] bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Pedido</p>
            <h2 className="text-2xl font-black text-slate-900">{currentOrder ? currentOrder.id : '1004'}</h2>
          </div>
          <button onClick={() => setScreen('home')} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">Voltar</button>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[24px] bg-slate-50 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700"><Map className="h-6 w-6" /></div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Rastreamento ativo</p>
                <p className="text-lg font-black text-slate-900">Seu pedido está em rota</p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {[
                { title: 'Pedido confirmado', time: '14:32', done: true },
                { title: 'Coletado na loja', time: '14:50', done: true },
                { title: 'A caminho', time: '15:10', done: false },
              ].map((step) => (
                <div key={step.title} className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${step.done ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {step.done ? <CheckCircle className="h-4 w-4" /> : <Bike className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{step.title}</p>
                    <p className="text-sm text-slate-500">{step.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] bg-slate-900 p-5 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Resumo</p>
            <p className="mt-3 text-2xl font-black">{currentOrder ? formatCurrency(currentOrder.value) : 'R$ 0,00'}</p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="flex justify-between"><span>Cliente</span><span>{currentOrder ? currentOrder.customer : 'Cliente'}</span></div>
              <div className="flex justify-between"><span>Agente</span><span>{currentOrder ? currentOrder.agent : 'Agente'}</span></div>
              <div className="flex justify-between"><span>Status</span><span>{currentOrder ? currentOrder.status : 'Processando'}</span></div>
              <div className="flex justify-between"><span>Pagamento</span><span>{currentOrder ? currentOrder.payment : 'Pix'}</span></div>
            </div>
            {currentOrder?.items?.length ? (
              <div className="mt-4 rounded-[20px] bg-white/10 p-3 text-sm text-slate-200">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Itens do pedido</p>
                <p className="mt-2 leading-6">{currentOrder.items.join(', ')}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )

  const renderProfileScreen = () => (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl rounded-[32px] bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Perfil</p>
            <h2 className="text-2xl font-black text-slate-900">{authUser?.name || 'Cliente'}</h2>
          </div>
          <button onClick={() => setScreen('home')} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">Voltar</button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[24px] bg-slate-50 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Dados da conta</p>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="flex justify-between"><span>E-mail</span><span className="font-semibold">{authUser?.email || 'cliente@primeiroaqui.com'}</span></div>
              <div className="flex justify-between"><span>Tipo</span><span className="font-semibold">{userRole === 'admin' ? 'Operação' : 'Cliente'}</span></div>
              <div className="flex justify-between"><span>Negócio</span><span className="font-semibold">{businessProfile?.name || 'Ainda não cadastrado'}</span></div>
              <div className="flex justify-between"><span>Endereço</span><span className="font-semibold">{businessProfile?.address || 'Rua da Esperança, 123'}</span></div>
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-200 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Ações</p>
            <div className="mt-4 space-y-3">
              <button onClick={() => setScreen('home')} className="w-full rounded-[18px] bg-slate-900 px-4 py-3 text-sm font-bold text-white">Voltar ao marketplace</button>
              <button onClick={handleLogout} className="w-full rounded-[18px] border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Sair da conta</button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Favoritos</p>
                <h3 className="text-lg font-black text-slate-900">Produtos salvos</h3>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">{favorites.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {favorites.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum favorito salvo ainda.</p>
              ) : favorites.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-[20px] bg-slate-50 p-3">
                  <div>
                    <p className="font-bold text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-500">{formatCurrency(item.price)}</p>
                  </div>
                  <button onClick={() => toggleFavorite(item)} className="rounded-full bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-700">Remover</button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Histórico</p>
                <h3 className="text-lg font-black text-slate-900">Últimos pedidos</h3>
              </div>
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">{orders.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {orders.slice(0, 3).map((order) => (
                <div key={order.id} className="rounded-[20px] bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">{order.id}</p>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{order.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{order.customer} • {formatCurrency(order.value)}</p>
                  {order.items?.length ? <p className="mt-1 text-xs text-slate-400">{order.items.length} item(s) • {order.payment || 'Pix'}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderAdminScreen = () => (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl rounded-[32px] bg-white p-4 shadow-lg md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Painel operacional</p>
            <h2 className="text-2xl font-black text-slate-900">Gestão multiagentes</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setScreen('home')} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Voltar</button>
            <button onClick={() => setScreen('home')} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">Marketplace</button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {['overview', 'agents', 'orders', 'performance'].map((tab) => (
            <button key={tab} onClick={() => setAdminTab(tab)} className={`rounded-full px-4 py-2 text-sm font-semibold ${adminTab === tab ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
              {tab === 'overview' ? 'Visão Geral' : tab === 'agents' ? 'Agentes' : tab === 'orders' ? 'Pedidos' : 'Desempenho'}
            </button>
          ))}
        </div>

        {adminTab === 'overview' && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              {overviewMetrics.map((item) => (
                <div key={item.label} className={`rounded-[24px] border border-slate-200 p-4 ${item.accent}`}>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-2 text-2xl font-black">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-[24px] border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-900">Agenda do dia</h3>
                  <p className="text-sm text-slate-500">Pontos de atenção da operação</p>
                </div>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">{schedule.length} tarefas</span>
              </div>
              <div className="mt-4 space-y-3">
                {schedule.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-[20px] bg-slate-50 p-3">
                    <div>
                      <p className="font-bold text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-500">{item.agent}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{item.time}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{item.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[24px] border border-slate-200 p-4">
                <h3 className="font-black text-slate-900">Últimos pedidos</h3>
                <div className="mt-4 space-y-2">
                  {orders.slice(0, 3).map((order) => (
                    <div key={order.id} className="flex items-center justify-between rounded-[20px] bg-slate-50 p-3">
                      <div>
                        <p className="font-bold text-slate-900">{order.id}</p>
                        <p className="text-sm text-slate-500">{order.customer}</p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{order.status}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-200 p-4">
                <h3 className="font-black text-slate-900">Performance por agente</h3>
                <div className="mt-4 space-y-3">
                  {agents.map((agent) => (
                    <div key={agent.id}>
                      <div className="flex items-center justify-between text-sm font-semibold text-slate-700"><span>{agent.name}</span><span>{agent.commission}%</span></div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-slate-900" style={{ width: `${70 + agent.commission}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {adminTab === 'agents' && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={handleAgentSubmit} className="rounded-[24px] border border-slate-200 p-4">
              <h3 className="font-black text-slate-900">{agentForm.id ? 'Editar agente' : 'Novo agente'}</h3>
              <div className="mt-4 space-y-3">
                <input value={agentForm.name} onChange={(event) => setAgentForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Nome" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />
                <input value={agentForm.region} onChange={(event) => setAgentForm((prev) => ({ ...prev, region: event.target.value }))} placeholder="Região" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />
                <input value={agentForm.specialty} onChange={(event) => setAgentForm((prev) => ({ ...prev, specialty: event.target.value }))} placeholder="Especialidade" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />
                <select value={agentForm.status} onChange={(event) => setAgentForm((prev) => ({ ...prev, status: event.target.value }))} className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none">
                  <option value="Disponível">Disponível</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Offline">Offline</option>
                </select>
                <input type="number" value={agentForm.commission} onChange={(event) => setAgentForm((prev) => ({ ...prev, commission: event.target.value }))} placeholder="Comissão (%)" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />
              </div>
              <div className="mt-4 flex gap-2">
                <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">Salvar</button>
                <button type="button" onClick={resetAgentForm} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Limpar</button>
              </div>
            </form>

            <div className="space-y-3">
              {agents.map((agent) => (
                <div key={agent.id} className="flex flex-wrap items-center justify-between rounded-[24px] border border-slate-200 p-4">
                  <div>
                    <p className="font-black text-slate-900">{agent.name}</p>
                    <p className="text-sm text-slate-500">{agent.specialty} • {agent.region}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{agent.status}</span>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">{agent.commission}%</span>
                    <button onClick={() => handleEditAgent(agent)} className="rounded-full bg-slate-100 p-2"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => handleDeleteAgent(agent.id)} className="rounded-full bg-red-50 p-2 text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {adminTab === 'orders' && (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-3">Pedido</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Agente</th>
                  <th className="px-3 py-3">Valor</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-semibold text-slate-900">{order.id}</td>
                    <td className="px-3 py-3 text-slate-700">{order.customer}</td>
                    <td className="px-3 py-3 text-slate-700">{order.agent}</td>
                    <td className="px-3 py-3 text-slate-700">{formatCurrency(order.value)}</td>
                    <td className="px-3 py-3">
                      <select value={order.status} onChange={(event) => handleStatusChange(order.id, event.target.value)} className="rounded-full border border-slate-200 px-3 py-2 text-sm"> 
                        <option value="Processando">Processando</option>
                        <option value="Em rota">Em rota</option>
                        <option value="Entregue">Entregue</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {adminTab === 'performance' && (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-[24px] border border-slate-200 p-4">
              <h3 className="font-black text-slate-900">Taxa de entrega</h3>
              <div className="mt-4 rounded-[20px] bg-slate-50 p-4">
                <div className="flex items-end gap-3">
                  {[60, 85, 72, 95].map((value, index) => (
                    <div key={index} className="flex-1">
                      <div className="rounded-t-[16px] bg-slate-900" style={{ height: `${value}px` }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-[24px] border border-slate-200 p-4">
              <h3 className="font-black text-slate-900">Ranking</h3>
              <div className="mt-4 space-y-3">
                {agents.slice().sort((a, b) => b.commission - a.commission).map((agent, index) => (
                  <div key={agent.id} className="flex items-center justify-between rounded-[20px] bg-slate-50 p-3">
                    <div>
                      <p className="font-bold text-slate-900">{index + 1}. {agent.name}</p>
                      <p className="text-sm text-slate-500">{agent.region}</p>
                    </div>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">{agent.commission}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (screen === 'login') return renderLoginScreen()
  if (screen === 'tracking') return renderTrackingScreen()
  if (screen === 'profile') return renderProfileScreen()
  if (screen === 'admin') return renderAdminScreen()
  return renderHomeScreen()
}
