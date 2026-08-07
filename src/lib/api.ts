import { readStoredJSON, writeStoredJSON } from './storage'
import type { ApiOrderStatus } from './orderStatus'

/**
 * Cliente HTTP tipado da API real (`/api`, mesma origem — ver
 * src/server/root.ts).
 *
 * Responsabilidades concentradas aqui, e só aqui:
 * - injetar o Bearer token da sessão persistida em toda chamada;
 * - derrubar a sessão local em qualquer 401 (token expirado/revogado) e
 *   avisar o app via `setOnUnauthorized`;
 * - transformar respostas de erro em `ApiError` com a mensagem pt-BR que o
 *   backend já manda no body (`{ error: '...' }`).
 *
 * Os DTOs abaixo espelham os shapes REAIS devolvidos pelas rotas em
 * src/server/routes/* — não inventar campo que o servidor não manda.
 */

// ---------------------------------------------------------------------------
// DTOs (shapes exatos das respostas do servidor)
// ---------------------------------------------------------------------------

export type ApiRole = 'BUYER' | 'STORE_OWNER' | 'ADMIN'

export interface ApiUser {
  id: string
  authUserId: string
  email: string
  name: string
  role: ApiRole
  avatarUrl: string | null
}

export interface ApiSession {
  accessToken: string
  refreshToken: string
  /** Epoch em segundos, como o Supabase devolve (`expires_at`). */
  expiresAt: number | undefined
}

export interface ApiProduct {
  id: string
  storeId: string
  title: string
  description: string | null
  category: string
  priceCents: number
  stock: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  /** 1a foto (position 0) do produto; null se nao houver. */
  photoUrl: string | null
  thumbUrl: string | null
}

export interface ApiStore {
  id: string
  name: string
  slug: string
  description: string | null
  latitude: number
  longitude: number
  category: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** Loja de GET /stores — listagem pública (rail "Lojas da cidade"). */
export interface ApiPublicStore {
  id: string
  name: string
  slug: string
  description: string | null
  category: string
}

/** Item de GET /me/favorites — projeção reduzida do produto, com a 1ª foto. */
export interface ApiFavoriteProduct {
  id: string
  storeId: string
  title: string
  priceCents: number
  isActive: boolean
  photoUrl: string | null
}

export interface ApiAddress {
  id: string
  userId: string
  label: string
  street: string
  city: string
  state: string
  zipCode: string
  latitude: number
  longitude: number
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface ApiOrderItem {
  id: string
  orderId: string
  productId: string
  quantity: number
  unitPriceCents: number
}

export interface ApiOrder {
  id: string
  buyerId: string
  storeId: string
  addressId: string
  totalCents: number
  status: ApiOrderStatus
  createdAt: string
  updatedAt: string
  items: ApiOrderItem[]
}

/** Pedido de GET /me/store-orders — o mesmo shape do pedido, mais o nome do comprador. */
export interface ApiStoreOrder extends ApiOrder {
  buyerName: string
}

// ------------------------------------------------------------------ admin

/** Resposta de GET /admin/metrics — visão geral da plataforma. */
export interface ApiAdminMetrics {
  totals: {
    users: number
    stores: number
    activeStores: number
    products: number
    orders: number
    /** Somatório de totalCents de pedidos não cancelados. */
    gmvCents: number
  }
  /** Contagem por status (só status com pelo menos 1 pedido aparecem). */
  ordersByStatus: Partial<Record<ApiOrderStatus, number>>
  /** Série diária dos últimos 30 dias, zero-preenchida, do mais antigo ao mais novo. */
  last30Days: Array<{ date: string; orders: number; gmvCents: number }>
}

/** Pedido de GET /admin/orders — pedido + comprador + loja. */
export interface ApiAdminOrder extends ApiOrder {
  buyerName: string
  storeName: string
}

/** Loja de GET /admin/stores — projeção de moderação. */
export interface ApiAdminStore {
  id: string
  name: string
  slug: string
  category: string
  ownerName: string
  productCount: number
  orderCount: number
  isActive: boolean
  createdAt: string
}

/** Foto de produto criada por POST /products/:id/photos. */
export interface ApiProductPhoto {
  id: string
  productId: string
  url: string
  thumbUrl: string
  path: string
  position: number
  createdAt: string
}

// ---------------------------------------------------------------------------
// Sessão persistida
// ---------------------------------------------------------------------------

export const SESSION_STORAGE_KEY = 'primeiroaqui_session'

const isStoredSession = (value: unknown): value is ApiSession =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as ApiSession).accessToken === 'string'

export const loadStoredSession = (): ApiSession | null =>
  readStoredJSON<ApiSession | null>(SESSION_STORAGE_KEY, null, (value): value is ApiSession | null =>
    value === null || isStoredSession(value),
  )

export const storeSession = (session: ApiSession | null): void => {
  writeStoredJSON(SESSION_STORAGE_KEY, session)
}

export const clearStoredSession = (): void => storeSession(null)

/**
 * Callback disparado quando qualquer chamada autenticada recebe 401 — o app
 * usa para limpar o estado de sessão em memória (o storage já foi limpo
 * aqui). Registrado por `useMarketplaceState`.
 */
let onUnauthorized: (() => void) | null = null
export const setOnUnauthorized = (handler: (() => void) | null): void => {
  onUnauthorized = handler
}

// ---------------------------------------------------------------------------
// Núcleo de requisição
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /** Body cru da resposta de erro — carrega os campos discriminados (ex.: `items` do 409 de estoque). */
    public body: unknown = undefined,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const GENERIC_ERROR = 'Não foi possível falar com o servidor. Tente novamente.'

/** Janela de antecedência para renovar a sessão antes do token expirar de verdade. */
const REFRESH_SKEW_SECONDS = 60

/**
 * Renovação de sessão em voo único (single-flight): se várias chamadas
 * percebem o token perto de expirar (ou tomam 401) ao mesmo tempo, todas
 * aguardam a MESMA requisição de refresh em vez de disparar uma cada — evita
 * corrida contra o refresh token do Supabase (de uso único).
 */
let refreshPromise: Promise<ApiSession | null> | null = null

async function refreshSession(): Promise<ApiSession | null> {
  if (refreshPromise) return refreshPromise

  const current = loadStoredSession()
  if (!current?.refreshToken) return null

  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      })
      if (!response.ok) return null
      const payload = (await response.json()) as { session: ApiSession }
      storeSession(payload.session)
      return payload.session
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

interface RequestOptions {
  method?: string
  /** Objeto JSON ou FormData (multipart — o browser define o Content-Type sozinho). */
  body?: unknown
}

async function request<T>(
  path: string,
  { method = 'GET', body }: RequestOptions = {},
  isRetryAfterRefresh = false,
): Promise<T> {
  // A própria rota de refresh nunca dispara outro refresh — evita recursão.
  let session = path === '/auth/refresh' ? null : loadStoredSession()

  if (session && !isRetryAfterRefresh && session.expiresAt !== undefined) {
    const secondsToExpiry = session.expiresAt - Date.now() / 1000
    if (secondsToExpiry < REFRESH_SKEW_SECONDS) {
      const refreshed = await refreshSession()
      if (refreshed) session = refreshed
    }
  }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const headers: Record<string, string> = {}
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json'
  if (session) headers['Authorization'] = `Bearer ${session.accessToken}`

  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    })
  } catch {
    // Rede fora, DNS, CORS: sem resposta do servidor.
    throw new ApiError(GENERIC_ERROR, 0)
  }

  // Body pode ser vazio ou não-JSON (proxy no meio do caminho) — não deixar
  // o parse derrubar o tratamento de erro.
  let payload: unknown = undefined
  try {
    payload = await response.json()
  } catch {
    payload = undefined
  }

  if (!response.ok) {
    if (response.status === 401 && session && path !== '/auth/refresh') {
      // Antes de derrubar a sessão, tenta renovar uma vez e refazer a
      // chamada original — só se esta ainda não é a repetição pós-refresh.
      if (!isRetryAfterRefresh) {
        const refreshed = await refreshSession()
        if (refreshed) return request<T>(path, { method, body }, true)
      }
      // Refresh falhou (ou já era retry): token expirado/revogado de vez.
      clearStoredSession()
      onUnauthorized?.()
    }
    const message =
      payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : GENERIC_ERROR
    throw new ApiError(message, response.status, payload)
  }

  return payload as T
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export interface ListProductsParams {
  category?: string
  q?: string
  storeId?: string
  limit?: number
  offset?: number
}

export const api = {
  signup: (input: { email: string; password: string; name: string }) =>
    request<{ user: ApiUser }>('/auth/signup', { method: 'POST', body: input }),

  login: (input: { email: string; password: string }) =>
    request<{ session: ApiSession; user: ApiUser }>('/auth/login', { method: 'POST', body: input }),

  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),

  forgotPassword: (email: string) =>
    request<{ ok: true }>('/auth/forgot-password', { method: 'POST', body: { email } }),

  resetPassword: (input: { accessToken: string; refreshToken: string; password: string }) =>
    request<{ ok: true }>('/auth/reset-password', { method: 'POST', body: input }),

  me: () => request<{ user: ApiUser }>('/me'),

  listProducts: (params: ListProductsParams = {}) => {
    const query = new URLSearchParams()
    if (params.category) query.set('category', params.category)
    if (params.q) query.set('q', params.q)
    if (params.storeId) query.set('storeId', params.storeId)
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    if (params.offset !== undefined) query.set('offset', String(params.offset))
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return request<{ products: ApiProduct[] }>(`/products${suffix}`)
  },

  getProduct: (id: string) => request<{ product: ApiProduct }>(`/products/${id}`),

  getStore: (id: string) => request<{ store: ApiStore }>(`/stores/${id}`),

  /** GET /stores (público) — lojas ativas ordenadas por nome, para a rail "Lojas da cidade". */
  listStores: (params?: { category?: string }) => {
    const query = new URLSearchParams()
    if (params?.category) query.set('category', params.category)
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return request<{ stores: ApiPublicStore[] }>(`/stores${suffix}`)
  },

  addFavorite: (productId: string) =>
    request<{ ok: true }>(`/favorites/${productId}`, { method: 'POST' }),

  removeFavorite: (productId: string) =>
    request<{ ok: true }>(`/favorites/${productId}`, { method: 'DELETE' }),

  listFavorites: () => request<{ products: ApiFavoriteProduct[] }>('/me/favorites'),

  createAddress: (input: {
    label: string
    street: string
    city: string
    state: string
    zipCode: string
    latitude: number
    longitude: number
    isDefault?: boolean
  }) => request<{ address: ApiAddress }>('/addresses', { method: 'POST', body: input }),

  listAddresses: () => request<{ addresses: ApiAddress[] }>('/me/addresses'),

  createOrder: (input: { items: Array<{ productId: string; quantity: number }>; addressId: string }) =>
    request<{ orders: ApiOrder[] }>('/orders', { method: 'POST', body: input }),

  listMyOrders: () => request<{ orders: ApiOrder[] }>('/me/orders'),

  // ------------------------------------------------------------ lojista
  becomeStoreOwner: () =>
    request<{ user: ApiUser }>('/me/become-store-owner', { method: 'POST' }),

  listMyStores: () => request<{ stores: ApiStore[] }>('/me/stores'),

  createStore: (input: {
    name: string
    slug: string
    description?: string
    latitude: number
    longitude: number
    category?: string
  }) => request<{ store: ApiStore }>('/stores', { method: 'POST', body: input }),

  listStoreOrders: () => request<{ orders: ApiStoreOrder[] }>('/me/store-orders'),

  updateOrderStatus: (orderId: string, status: ApiOrderStatus) =>
    request<{ order: ApiOrder }>(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: { status },
    }),

  createProduct: (
    storeId: string,
    input: { title: string; description?: string; category: string; priceCents: number; stock: number },
  ) => request<{ product: ApiProduct }>(`/stores/${storeId}/products`, { method: 'POST', body: input }),

  updateProduct: (
    productId: string,
    input: Partial<{ title: string; description: string; category: string; priceCents: number; stock: number; isActive: boolean }>,
  ) => request<{ product: ApiProduct }>(`/products/${productId}`, { method: 'PATCH', body: input }),

  // ------------------------------------------------------------ admin
  adminMetrics: () => request<ApiAdminMetrics>('/admin/metrics'),

  adminOrders: (params: { limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    if (params.offset !== undefined) query.set('offset', String(params.offset))
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return request<{ orders: ApiAdminOrder[]; total: number }>(`/admin/orders${suffix}`)
  },

  adminStores: () => request<{ stores: ApiAdminStore[] }>('/admin/stores'),

  adminSetStoreActive: (storeId: string, isActive: boolean) =>
    request<{ store: Pick<ApiAdminStore, 'id' | 'name' | 'slug' | 'isActive'> }>(
      `/admin/stores/${storeId}`,
      { method: 'PATCH', body: { isActive } },
    ),

  uploadProductPhoto: (productId: string, file: File) => {
    const form = new FormData()
    form.append('photo', file)
    return request<{ photo: ApiProductPhoto }>(`/products/${productId}/photos`, {
      method: 'POST',
      body: form,
    })
  },

  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ user: ApiUser }>('/me/avatar', { method: 'POST', body: form })
  },

  removeAvatar: () => request<{ user: ApiUser }>('/me/avatar', { method: 'DELETE' }),
}
