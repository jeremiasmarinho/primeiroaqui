import { http, HttpResponse } from 'msw'

import type {
  ApiAddress,
  ApiAdminMetrics,
  ApiAdminOrder,
  ApiAdminStore,
  ApiFavoriteProduct,
  ApiOrder,
  ApiPayOrderInput,
  ApiProduct,
  ApiStore,
  ApiStoreCustomer,
  ApiStoreOrder,
  ApiUser,
} from '../../lib/api'
import { isValidOrderTransition, orderStatusLabel, type ApiOrderStatus } from '../../lib/orderStatus'

/**
 * Fake em memória da API real para a suíte de UI.
 *
 * Espelha os shapes e regras de src/server/routes/* (campos exatos, erros
 * pt-BR, 409 de estoque) sem tocar em rede. O estado muda durante um teste
 * (favoritar, criar endereço, checkout) e `resetMockDb()` — chamado no
 * afterEach global (src/test/setup.ts) — devolve tudo ao ponto de partida.
 */

const now = '2026-08-01T12:00:00.000Z'

export const mockUser: ApiUser = {
  id: 'user-1',
  authUserId: 'auth-user-1',
  email: 'cliente@primeiroaqui.com',
  name: 'Cliente Primeiro Aqui',
  role: 'BUYER',
  avatarUrl: null,
}

// Ids e títulos espelham o catálogo de demonstração antigo — os testes de
// tela citam esses nomes/urls (ex.: /produto/1, /loja/mercado-central).
export const mockStores: ApiStore[] = [
  { id: 'loja-vizinhanca', name: 'Loja Vizinhança', slug: 'loja-vizinhanca', description: 'Centro', latitude: 0, longitude: 0, category: 'OUTROS', logoUrl: null, isActive: true, createdAt: now, updatedAt: now },
  { id: 'mercado-central', name: 'Mercado Central', slug: 'mercado-central', description: 'Zona Norte', latitude: 0, longitude: 0, category: 'MERCADO', logoUrl: null, isActive: true, createdAt: now, updatedAt: now },
  { id: 'tech-shop', name: 'Tech Shop', slug: 'tech-shop', description: 'Centro', latitude: 0, longitude: 0, category: 'OUTROS', logoUrl: null, isActive: true, createdAt: now, updatedAt: now },
  { id: 'farmacia-local', name: 'Farmácia Local', slug: 'farmacia-local', description: 'Zona Sul', latitude: 0, longitude: 0, category: 'FARMACIA', logoUrl: null, isActive: true, createdAt: now, updatedAt: now },
]

const baseProducts: ApiProduct[] = [
  // Produto 1 tem foto semeada — exercita o caminho "com foto" nos testes de UI.
  { id: '1', storeId: 'loja-vizinhanca', title: 'Ventilador de Mesa Premium 6 Pás Silencioso', description: null, category: 'Casa', priceCents: 19990, stock: 10, isActive: true, createdAt: now, updatedAt: now, photoUrl: 'https://example.com/ventilador.jpg', thumbUrl: 'https://example.com/ventilador-thumb.jpg' },
  { id: '2', storeId: 'mercado-central', title: 'Kit Supermercado Express — 18 itens essenciais', description: null, category: 'Supermercado', priceCents: 12990, stock: 10, isActive: true, createdAt: now, updatedAt: now, photoUrl: null, thumbUrl: null },
  { id: '3', storeId: 'tech-shop', title: 'Smartwatch Fitness GPS à Prova d’Água', description: null, category: 'Eletrônico', priceCents: 37990, stock: 5, isActive: true, createdAt: now, updatedAt: now, photoUrl: null, thumbUrl: null },
  { id: '4', storeId: 'farmacia-local', title: 'Box de Cuidados Pessoais com 12 Produtos', description: null, category: 'Farmácia', priceCents: 8490, stock: 8, isActive: true, createdAt: now, updatedAt: now, photoUrl: null, thumbUrl: null },
  { id: '5', storeId: 'farmacia-local', title: 'Whey Concentrado 900g Sabor Baunilha', description: null, category: 'Farmácia', priceCents: 13769, stock: 3, isActive: true, createdAt: now, updatedAt: now, photoUrl: null, thumbUrl: null },
]

interface MockDb {
  /** Usuário "logado" — o papel muda com POST /me/become-store-owner. */
  user: ApiUser
  products: ApiProduct[]
  favorites: Set<string>
  addresses: ApiAddress[]
  orders: ApiOrder[]
  /** Lojas do usuário logado (GET /me/stores, POST /stores). */
  myStores: ApiStore[]
  /** Pedidos recebidos pelas lojas do usuário (GET /me/store-orders). */
  storeOrders: ApiStoreOrder[]
  /** Clientes agregados das lojas do usuário (GET /me/store-customers). */
  storeCustomers: ApiStoreCustomer[]
  /** Visão da plataforma inteira (GET /admin/*). */
  adminMetrics: ApiAdminMetrics
  adminOrders: ApiAdminOrder[]
  adminStores: ApiAdminStore[]
  seq: number
  /**
   * Controla o desfecho de POST /orders/:id/pay nos testes de UI:
   * 'paid' (default) aprova cartão/gera Pix pendente; 'declined' simula
   * recusa do cartão pela operadora; 'pix_gated' simula o action_forbidden
   * real do sandbox (Pix indisponível na conta).
   */
  paymentScenario: 'paid' | 'declined' | 'pix_gated'
  /**
   * Espelha a feature flag por ambiente de GET /payments/config (2026-08-07):
   * default true (chaves configuradas) para não quebrar os testes de
   * pagamento já escritos; `setPaymentsEnabled(false)` simula produção sem
   * as chaves do Pagar.me — a etapa de pagamento não deve nem aparecer.
   */
  paymentsEnabled: boolean
}

const emptyAdminMetrics = (): ApiAdminMetrics => ({
  totals: { users: 0, stores: 0, activeStores: 0, products: 0, orders: 0, gmvCents: 0 },
  ordersByStatus: {},
  last30Days: Array.from({ length: 30 }, (_, i) => {
    const day = new Date('2026-07-03T00:00:00.000Z')
    day.setUTCDate(day.getUTCDate() + i)
    return { date: day.toISOString().slice(0, 10), orders: 0, gmvCents: 0 }
  }),
})

const createDb = (): MockDb => ({
  user: { ...mockUser },
  products: baseProducts.map((product) => ({ ...product })),
  favorites: new Set<string>(),
  addresses: [],
  orders: [],
  myStores: [],
  storeOrders: [],
  storeCustomers: [],
  adminMetrics: emptyAdminMetrics(),
  adminOrders: [],
  adminStores: [],
  seq: 0,
  paymentScenario: 'paid',
  paymentsEnabled: true,
})

export let db: MockDb = createDb()

export const resetMockDb = (): void => {
  db = createDb()
}

/** Atalho de teste: define o desfecho do próximo POST /orders/:id/pay. */
export const setPaymentScenario = (scenario: MockDb['paymentScenario']): void => {
  db.paymentScenario = scenario
}

/** Atalho de teste: simula a feature flag de GET /payments/config (chaves ausentes = false). */
export const setPaymentsEnabled = (enabled: boolean): void => {
  db.paymentsEnabled = enabled
}

/** Semeia um endereço salvo — atalho para testes de checkout. */
export const seedAddress = (overrides: Partial<ApiAddress> = {}): ApiAddress => {
  const address: ApiAddress = {
    id: `addr-${++db.seq}`,
    userId: mockUser.id,
    label: 'Casa',
    street: 'Rua Um, 100',
    city: 'Centro',
    state: 'SP',
    zipCode: '12345-678',
    latitude: 0,
    longitude: 0,
    isDefault: db.addresses.length === 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
  db.addresses.unshift(address)
  return address
}

/** Semeia loja + papel de lojista — atalho para testes do painel /minha-loja. */
export const seedStoreOwner = (overrides: Partial<ApiStore> = {}): ApiStore => {
  db.user.role = 'STORE_OWNER'
  const store: ApiStore = {
    id: `store-${++db.seq}`,
    name: 'Loja da Ana',
    slug: 'loja-da-ana',
    description: 'Loja local',
    latitude: 0,
    longitude: 0,
    category: 'OUTROS',
    logoUrl: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
  db.myStores.push(store)
  return store
}

/** Semeia um pedido recebido pela loja do lojista logado. */
export const seedStoreOrder = (
  storeId: string,
  overrides: Partial<ApiStoreOrder> = {},
): ApiStoreOrder => {
  const orderId = `store-order-${++db.seq}`
  const order: ApiStoreOrder = {
    id: orderId,
    buyerId: 'buyer-2',
    buyerName: 'João Comprador',
    storeId,
    addressId: 'addr-x',
    totalCents: 19990,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [{ id: `${orderId}-item-0`, orderId, productId: '1', quantity: 1, unitPriceCents: 19990 }],
    ...overrides,
  }
  db.storeOrders.unshift(order)
  return order
}

/** Semeia um cliente agregado do painel de CRM (aba "Clientes"). */
export const seedStoreCustomer = (overrides: Partial<ApiStoreCustomer> = {}): ApiStoreCustomer => {
  const customer: ApiStoreCustomer = {
    buyerId: `buyer-${++db.seq}`,
    name: 'João Comprador',
    ordersCount: 1,
    totalCents: 19990,
    lastOrderAt: new Date().toISOString(),
    lastOrderStatus: 'DELIVERED',
    ...overrides,
  }
  db.storeCustomers.push(customer)
  return customer
}

/**
 * Semeia a visão de plataforma do painel admin e promove o usuário logado a
 * ADMIN (como no backend real, o papel vem do GET /api/me — nunca do client).
 */
export const seedAdmin = (
  overrides: Partial<Pick<MockDb, 'adminMetrics' | 'adminOrders' | 'adminStores'>> = {},
): void => {
  db.user.role = 'ADMIN'
  db.adminMetrics = overrides.adminMetrics ?? {
    totals: { users: 12, stores: 4, activeStores: 3, products: 25, orders: 9, gmvCents: 123450 },
    ordersByStatus: { PENDING: 2, CONFIRMED: 3, DELIVERED: 3, CANCELED: 1 },
    last30Days: emptyAdminMetrics().last30Days.map((day, index) =>
      index >= 27 ? { ...day, orders: index - 26, gmvCents: (index - 26) * 10000 } : day,
    ),
  }
  db.adminOrders = overrides.adminOrders ?? []
  db.adminStores = overrides.adminStores ?? []
}

/** Semeia um pedido da plataforma (GET /api/admin/orders). */
export const seedAdminOrder = (overrides: Partial<ApiAdminOrder> = {}): ApiAdminOrder => {
  const orderId = `admin-order-${++db.seq}`
  const order: ApiAdminOrder = {
    id: orderId,
    buyerId: 'buyer-2',
    buyerName: 'João Comprador',
    storeId: 'loja-vizinhanca',
    storeName: 'Loja Vizinhança',
    addressId: 'addr-x',
    totalCents: 19990,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [{ id: `${orderId}-item-0`, orderId, productId: '1', quantity: 1, unitPriceCents: 19990 }],
    ...overrides,
  }
  db.adminOrders.unshift(order)
  return order
}

/** Semeia uma loja na lista de moderação (GET /api/admin/stores). */
export const seedAdminStore = (overrides: Partial<ApiAdminStore> = {}): ApiAdminStore => {
  const store: ApiAdminStore = {
    id: `admin-store-${++db.seq}`,
    name: 'Loja da Ana',
    slug: 'loja-da-ana',
    category: 'OUTROS',
    ownerName: 'Ana Lojista',
    productCount: 3,
    orderCount: 5,
    isActive: true,
    createdAt: now,
    ...overrides,
  }
  db.adminStores.push(store)
  return store
}

const unauthorized = () => HttpResponse.json({ error: 'Nao autenticado' }, { status: 401 })

const forbiddenAdmin = () =>
  HttpResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })

const requireAuth = (request: Request): boolean =>
  Boolean(request.headers.get('authorization')?.startsWith('Bearer '))

export const handlers = [
  http.get('/__health', () => HttpResponse.json({ ok: true })),

  // ------------------------------------------------------------------ auth
  http.post('/api/auth/signup', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string; name?: string }
    if (!body?.email || !body?.password || !body?.name) {
      return HttpResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }
    if (body.email === 'existente@primeiroaqui.com') {
      return HttpResponse.json({ error: 'Nao foi possivel criar o usuario' }, { status: 409 })
    }
    return HttpResponse.json(
      { user: { ...mockUser, email: body.email, name: body.name } },
      { status: 201 },
    )
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }
    // Qualquer credencial com senha "errada..." falha; o resto autentica.
    if (!body?.email || body?.password === 'senha-errada') {
      return HttpResponse.json({ error: 'E-mail ou senha invalidos' }, { status: 401 })
    }
    return HttpResponse.json({
      session: { accessToken: 'test-token', refreshToken: 'test-refresh', expiresAt: 9999999999 },
      user: { ...db.user, email: body.email },
    })
  }),

  http.post('/api/auth/logout', () => HttpResponse.json({ ok: true })),

  // Sempre 200 genérico — espelha a rota real (anti-enumeração).
  http.post('/api/auth/forgot-password', () => HttpResponse.json({ ok: true })),

  http.post('/api/auth/reset-password', async ({ request }) => {
    const body = (await request.json()) as {
      accessToken?: string
      refreshToken?: string
      password?: string
    }
    if (!body?.accessToken || !body?.refreshToken) {
      return HttpResponse.json({ error: 'Link de redefinicao invalido ou expirado' }, { status: 401 })
    }
    if (!body?.password || body.password.length < 8) {
      return HttpResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }
    if (body.accessToken === 'token-expirado') {
      return HttpResponse.json({ error: 'Link de redefinicao invalido ou expirado' }, { status: 401 })
    }
    return HttpResponse.json({ ok: true })
  }),

  http.get('/api/auth/oauth-url', ({ request }) => {
    const url = new URL(request.url)
    const provider = url.searchParams.get('provider')
    const redirect = url.searchParams.get('redirect') ?? '/'
    if (provider !== 'google') {
      return HttpResponse.json({ error: 'Provedor OAuth invalido' }, { status: 400 })
    }
    const redirectTo = `https://app.test/entrar/callback?redirect=${encodeURIComponent(redirect)}`
    return HttpResponse.json({
      url: `https://proj.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`,
    })
  }),

  http.post('/api/auth/oauth-complete', async ({ request }) => {
    const body = (await request.json()) as {
      accessToken?: string
      refreshToken?: string
      expiresAt?: number
    }
    if (!body?.accessToken || !body?.refreshToken) {
      return HttpResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }
    if (body.accessToken === 'token-invalido') {
      return HttpResponse.json({ error: 'Sessao OAuth invalida ou expirada' }, { status: 401 })
    }
    return HttpResponse.json({
      session: {
        accessToken: body.accessToken,
        refreshToken: body.refreshToken,
        expiresAt: body.expiresAt ?? 9999999999,
      },
      user: { ...db.user, name: 'Usuario Google', avatarUrl: 'https://example.com/avatar-google.jpg' },
    })
  }),

  http.post('/api/auth/refresh', async ({ request }) => {
    const body = (await request.json()) as { refreshToken?: string }
    if (!body?.refreshToken || body.refreshToken === 'refresh-invalido') {
      return HttpResponse.json({ error: 'Sessao expirada, faca login novamente' }, { status: 401 })
    }
    return HttpResponse.json({
      session: { accessToken: 'test-token-renovado', refreshToken: 'test-refresh-renovado', expiresAt: 9999999999 },
    })
  }),

  http.get('/api/me', ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    return HttpResponse.json({ user: db.user })
  }),

  // --------------------------------------------------------------- catálogo
  http.get('/api/products', ({ request }) => {
    const storeId = new URL(request.url).searchParams.get('storeId')
    if (storeId) {
      // Como no backend real: o dono (usuário logado com loja própria) vê
      // também os inativos; público só os ativos.
      const ownerView = requireAuth(request) && db.myStores.some((store) => store.id === storeId)
      const products = db.products.filter(
        (product) => product.storeId === storeId && (ownerView || product.isActive),
      )
      return HttpResponse.json({ products })
    }
    return HttpResponse.json({ products: db.products })
  }),

  http.get('/api/products/:id', ({ params }) => {
    const product = db.products.find((item) => item.id === params.id)
    if (!product || !product.isActive) {
      return HttpResponse.json({ error: 'Produto nao encontrado' }, { status: 404 })
    }
    return HttpResponse.json({ product })
  }),

  http.get('/api/stores/:id', ({ params }) => {
    const store = mockStores.find((item) => item.id === params.id)
    if (!store) return HttpResponse.json({ error: 'Loja nao encontrada' }, { status: 404 })
    return HttpResponse.json({ store })
  }),

  http.get('/api/stores', ({ request }) => {
    const url = new URL(request.url)
    const category = url.searchParams.get('category')
    const stores = mockStores
      .filter((store) => store.isActive)
      .filter((store) => !category || store.category === category)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ id, name, slug, description, category: storeCategory }) => ({
        id,
        name,
        slug,
        description,
        category: storeCategory,
      }))
    return HttpResponse.json({ stores })
  }),

  // -------------------------------------------------------------- favoritos
  http.post('/api/favorites/:productId', ({ request, params }) => {
    if (!requireAuth(request)) return unauthorized()
    db.favorites.add(String(params.productId))
    return HttpResponse.json({ ok: true })
  }),

  http.delete('/api/favorites/:productId', ({ request, params }) => {
    if (!requireAuth(request)) return unauthorized()
    db.favorites.delete(String(params.productId))
    return HttpResponse.json({ ok: true })
  }),

  http.get('/api/me/favorites', ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    const products: ApiFavoriteProduct[] = Array.from(db.favorites)
      .map((id) => db.products.find((product) => product.id === id))
      .filter((product): product is ApiProduct => Boolean(product))
      .map((product) => ({
        id: product.id,
        storeId: product.storeId,
        title: product.title,
        priceCents: product.priceCents,
        isActive: product.isActive,
        photoUrl: null,
      }))
    return HttpResponse.json({ products })
  }),

  // -------------------------------------------------------------- endereços
  http.post('/api/addresses', async ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    const body = (await request.json()) as Partial<ApiAddress>
    const address = seedAddress({
      label: body.label ?? '',
      street: body.street ?? '',
      city: body.city ?? '',
      state: body.state ?? '',
      zipCode: body.zipCode ?? '',
      isDefault: body.isDefault ?? false,
    })
    return HttpResponse.json({ address }, { status: 201 })
  }),

  http.get('/api/me/addresses', ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    return HttpResponse.json({ addresses: db.addresses })
  }),

  // ---------------------------------------------------------------- pedidos
  http.post('/api/orders', async ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    const body = (await request.json()) as {
      items?: Array<{ productId: string; quantity: number }>
      addressId?: string
    }
    if (!body?.items?.length || !body.addressId) {
      return HttpResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }
    if (!db.addresses.some((address) => address.id === body.addressId)) {
      return HttpResponse.json({ error: 'Endereco nao encontrado' }, { status: 404 })
    }

    const insufficient: Array<{ productId: string }> = []
    for (const item of body.items) {
      const product = db.products.find((candidate) => candidate.id === item.productId)
      if (!product || !product.isActive) {
        return HttpResponse.json(
          { error: 'Produto nao encontrado', productId: item.productId },
          { status: 404 },
        )
      }
      if (product.stock < item.quantity) insufficient.push({ productId: item.productId })
    }
    if (insufficient.length > 0) {
      return HttpResponse.json(
        { error: 'Estoque insuficiente', items: insufficient },
        { status: 409 },
      )
    }

    // Um pedido por loja, como o backend real.
    const byStore = new Map<string, Array<{ productId: string; quantity: number; unitPriceCents: number }>>()
    for (const item of body.items) {
      const product = db.products.find((candidate) => candidate.id === item.productId)!
      product.stock -= item.quantity
      const list = byStore.get(product.storeId) ?? []
      list.push({ productId: item.productId, quantity: item.quantity, unitPriceCents: product.priceCents })
      byStore.set(product.storeId, list)
    }

    const orders: ApiOrder[] = Array.from(byStore, ([storeId, items]) => {
      const orderId = `order-${++db.seq}`
      return {
        id: orderId,
        buyerId: mockUser.id,
        storeId,
        addressId: body.addressId!,
        totalCents: items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0),
        status: 'PENDING' as const,
        createdAt: now,
        updatedAt: now,
        items: items.map((item, index) => ({
          id: `${orderId}-item-${index}`,
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
      }
    })
    db.orders.unshift(...orders)
    return HttpResponse.json({ orders }, { status: 201 })
  }),

  http.get('/api/me/orders', ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    return HttpResponse.json({ orders: db.orders })
  }),

  // ---------------------------------------------------------------- lojista
  http.post('/api/me/become-store-owner', ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    if (db.user.role === 'BUYER') db.user.role = 'STORE_OWNER'
    return HttpResponse.json({ user: db.user })
  }),

  http.get('/api/me/stores', ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    if (db.user.role === 'BUYER') {
      return HttpResponse.json({ error: 'Acesso restrito a donos de loja' }, { status: 403 })
    }
    return HttpResponse.json({ stores: db.myStores })
  }),

  http.post('/api/stores', async ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    if (db.user.role === 'BUYER') {
      return HttpResponse.json({ error: 'Acesso restrito a donos de loja' }, { status: 403 })
    }
    const body = (await request.json()) as {
      name?: string
      slug?: string
      description?: string
      latitude?: number
      longitude?: number
      category?: string
    }
    if (!body?.name || !body?.slug) {
      return HttpResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }
    if (db.myStores.some((store) => store.slug === body.slug)) {
      return HttpResponse.json({ error: 'Slug ja esta em uso' }, { status: 409 })
    }
    const store: ApiStore = {
      id: `store-${++db.seq}`,
      name: body.name,
      slug: body.slug,
      description: body.description ?? null,
      latitude: body.latitude ?? 0,
      longitude: body.longitude ?? 0,
      category: body.category ?? 'OUTROS',
      logoUrl: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }
    db.myStores.push(store)
    return HttpResponse.json({ store }, { status: 201 })
  }),

  http.get('/api/me/store-orders', ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    if (db.user.role === 'BUYER') {
      return HttpResponse.json({ error: 'Acesso restrito a donos de loja' }, { status: 403 })
    }
    return HttpResponse.json({ orders: db.storeOrders })
  }),

  http.patch('/api/orders/:id/status', async ({ request, params }) => {
    if (!requireAuth(request)) return unauthorized()
    const body = (await request.json()) as { status?: ApiOrderStatus }
    // Admin atualiza qualquer pedido da plataforma; lojista, os da loja dele.
    const order =
      db.storeOrders.find((item) => item.id === params.id) ??
      db.adminOrders.find((item) => item.id === params.id)
    if (!order) return HttpResponse.json({ error: 'Pedido nao encontrado' }, { status: 404 })
    if (!body?.status || !isValidOrderTransition(order.status, body.status)) {
      return HttpResponse.json(
        {
          error: `Transição de status inválida: um pedido "${orderStatusLabel(order.status)}" não pode ir para "${orderStatusLabel(String(body?.status))}".`,
        },
        { status: 409 },
      )
    }
    order.status = body.status
    order.updatedAt = new Date().toISOString()
    return HttpResponse.json({ order })
  }),

  http.post('/api/stores/:storeId/products', async ({ request, params }) => {
    if (!requireAuth(request)) return unauthorized()
    const body = (await request.json()) as {
      title?: string
      description?: string
      category?: string
      priceCents?: number
      stock?: number
    }
    if (!body?.title || !body?.category || !body?.priceCents) {
      return HttpResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }
    const product: ApiProduct = {
      id: `product-${++db.seq}`,
      storeId: String(params.storeId),
      title: body.title,
      description: body.description ?? null,
      category: body.category,
      priceCents: body.priceCents,
      stock: body.stock ?? 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      photoUrl: null,
      thumbUrl: null,
    }
    db.products.push(product)
    return HttpResponse.json({ product }, { status: 201 })
  }),

  http.patch('/api/products/:id', async ({ request, params }) => {
    if (!requireAuth(request)) return unauthorized()
    const product = db.products.find((item) => item.id === params.id)
    if (!product) return HttpResponse.json({ error: 'Produto nao encontrado' }, { status: 404 })
    const body = (await request.json()) as Partial<
      Pick<ApiProduct, 'title' | 'description' | 'category' | 'priceCents' | 'stock' | 'isActive'>
    >
    Object.assign(product, body, { updatedAt: new Date().toISOString() })
    return HttpResponse.json({ product })
  }),

  // ------------------------------------------------------------------ admin
  http.get('/api/admin/metrics', ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    if (db.user.role !== 'ADMIN') return forbiddenAdmin()
    return HttpResponse.json(db.adminMetrics)
  }),

  http.get('/api/admin/orders', ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    if (db.user.role !== 'ADMIN') return forbiddenAdmin()
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? 20)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    return HttpResponse.json({
      orders: db.adminOrders.slice(offset, offset + limit),
      total: db.adminOrders.length,
    })
  }),

  http.get('/api/admin/stores', ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    if (db.user.role !== 'ADMIN') return forbiddenAdmin()
    return HttpResponse.json({ stores: db.adminStores })
  }),

  http.patch('/api/admin/stores/:id', async ({ request, params }) => {
    if (!requireAuth(request)) return unauthorized()
    if (db.user.role !== 'ADMIN') return forbiddenAdmin()
    const body = (await request.json()) as { isActive?: unknown }
    if (typeof body?.isActive !== 'boolean') {
      return HttpResponse.json({ error: 'Informe isActive como booleano' }, { status: 400 })
    }
    const store = db.adminStores.find((item) => item.id === params.id)
    if (!store) return HttpResponse.json({ error: 'Loja nao encontrada' }, { status: 404 })
    store.isActive = body.isActive
    return HttpResponse.json({
      store: { id: store.id, name: store.name, slug: store.slug, isActive: store.isActive },
    })
  }),

  // ----------------------------------------------------------------- avatar
  http.post('/api/me/avatar', async ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return HttpResponse.json({ error: 'Body invalido ou ausente' }, { status: 400 })
    }
    const file = form.get('file')
    // Nao usa `instanceof File`: o `File` reconstruido por `request.formData()`
    // pertence a implementacao interna do fetch (undici), que pode nao ser o
    // mesmo objeto de classe exposto em `globalThis.File` neste ambiente de
    // teste (jsdom + fetch nativo) — duck-typing evita esse falso negativo.
    const isFileLike = (value: unknown): value is { type: string } =>
      !!value && typeof value === 'object' && 'type' in value && 'size' in value && 'arrayBuffer' in value
    if (!isFileLike(file)) {
      return HttpResponse.json({ error: 'Campo "file" (arquivo) e obrigatorio' }, { status: 400 })
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      return HttpResponse.json({ error: `Tipo de arquivo nao suportado: ${file.type}` }, { status: 400 })
    }
    db.user.avatarUrl = `https://example.com/avatars/${db.user.id}-${++db.seq}.jpg`
    return HttpResponse.json({ user: db.user })
  }),

  http.delete('/api/me/avatar', ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    db.user.avatarUrl = null
    return HttpResponse.json({ user: db.user })
  }),

  http.post('/api/products/:id/photos', ({ request, params }) => {
    if (!requireAuth(request)) return unauthorized()
    return HttpResponse.json(
      {
        photo: {
          id: `photo-${++db.seq}`,
          productId: String(params.id),
          url: 'https://example.com/foto.jpg',
          thumbUrl: 'https://example.com/foto-thumb.jpg',
          path: 'mock/foto.jpg',
          position: 0,
          createdAt: now,
        },
      },
      { status: 201 },
    )
  }),

  // ------------------------------------------------------------- logo da loja
  http.post('/api/me/stores/:id/logo', async ({ request, params }) => {
    if (!requireAuth(request)) return unauthorized()
    const store = db.myStores.find((item) => item.id === params.id)
    if (!store) {
      return HttpResponse.json({ error: 'Voce nao tem permissao para editar esta loja' }, { status: 403 })
    }
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return HttpResponse.json({ error: 'Body invalido ou ausente' }, { status: 400 })
    }
    const file = form.get('file')
    const isFileLike = (value: unknown): value is { type: string } =>
      !!value && typeof value === 'object' && 'type' in value && 'size' in value && 'arrayBuffer' in value
    if (!isFileLike(file)) {
      return HttpResponse.json({ error: 'Campo "file" (arquivo) e obrigatorio' }, { status: 400 })
    }
    store.logoUrl = `https://example.com/store-logos/${store.id}-${++db.seq}.jpg`
    return HttpResponse.json({ store })
  }),

  http.delete('/api/me/stores/:id/logo', ({ request, params }) => {
    if (!requireAuth(request)) return unauthorized()
    const store = db.myStores.find((item) => item.id === params.id)
    if (!store) {
      return HttpResponse.json({ error: 'Voce nao tem permissao para editar esta loja' }, { status: 403 })
    }
    store.logoUrl = null
    return HttpResponse.json({ store })
  }),

  // --------------------------------------------------------------------- CRM
  http.get('/api/me/store-customers', ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    if (db.user.role === 'BUYER') {
      return HttpResponse.json({ error: 'Acesso restrito a donos de loja' }, { status: 403 })
    }
    return HttpResponse.json({ customers: db.storeCustomers })
  }),

  // ------------------------------------------------------------- pagamento
  http.get('/api/payments/config', () =>
    HttpResponse.json(
      db.paymentsEnabled ? { enabled: true, publicKey: 'pk_test_mock' } : { enabled: false },
    ),
  ),

  /**
   * Tokenização client-side (URL ABSOLUTA — espelha o Pagar.me real, não
   * passa pelo nosso servidor). Falha só se o número não passar no Luhn
   * (mesma checagem visual que o formulário já faz antes de chamar isso).
   */
  http.post('https://api.pagar.me/core/v5/tokens', async ({ request }) => {
    const body = (await request.json()) as { card?: { number?: string } }
    if (!body?.card?.number) {
      return HttpResponse.json({ message: 'Dados do cartão inválidos' }, { status: 400 })
    }
    return HttpResponse.json({ id: `token_${++db.seq}`, type: 'card' }, { status: 200 })
  }),

  http.post('/api/orders/:id/pay', async ({ request, params }) => {
    if (!requireAuth(request)) return unauthorized()
    const order = db.orders.find((item) => item.id === params.id)
    if (!order) return HttpResponse.json({ error: 'Pedido nao encontrado' }, { status: 404 })

    const body = (await request.json()) as ApiPayOrderInput

    if (body.method === 'pix' && db.paymentScenario === 'pix_gated') {
      return HttpResponse.json(
        { error: 'Pix indisponível no momento, use cartão', code: 'PAYMENT_METHOD_UNAVAILABLE' },
        { status: 409 },
      )
    }
    if (body.method === 'credit_card' && db.paymentScenario === 'declined') {
      return HttpResponse.json({ error: 'Cartão recusado pela operadora. Tente outro cartão.' }, { status: 502 })
    }

    order.paymentStatus = body.method === 'pix' ? 'PENDING' : 'PAID'

    return HttpResponse.json({
      order,
      pagarmeOrderId: `ord_pagarme_${db.seq}`,
      status: order.paymentStatus === 'PAID' ? 'paid' : 'pending',
      pix:
        body.method === 'pix'
          ? {
              qrCode: '000201mockqrcode',
              qrCodeUrl: 'https://example.com/qr/mock.png',
              expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            }
          : undefined,
    })
  }),

  http.get('/api/orders/:id/payment', ({ request, params }) => {
    if (!requireAuth(request)) return unauthorized()
    const order = db.orders.find((item) => item.id === params.id)
    if (!order) return HttpResponse.json({ error: 'Pedido nao encontrado' }, { status: 404 })
    return HttpResponse.json({
      paymentStatus: order.paymentStatus ?? 'NONE',
      pagarmeOrderId: null,
      platformFeeCents: null,
      storeAmountCents: null,
    })
  }),
]
