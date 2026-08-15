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
  /** Presentes só nas respostas que incluem o perfil completo (ex.: PATCH /me). */
  phone?: string | null
  document?: string | null
}

export interface ApiSession {
  accessToken: string
  refreshToken: string
  /** Epoch em segundos, como o Supabase devolve (`expires_at`). */
  expiresAt: number | undefined
}

/** Resposta de POST /auth/login quando o usuário tem TOTP ativo — login ainda não terminou. */
export interface ApiMfaChallengeRequired {
  mfaRequired: true
  factorId: string
  tempSession: ApiSession
}

export type ApiLoginResult = { session: ApiSession; user: ApiUser } | ApiMfaChallengeRequired

export interface ApiMfaFactor {
  id: string
  status: 'verified' | 'unverified'
  createdAt: string
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
  logoUrl: string | null
  isActive: boolean
  /** Item 9 — loja embala o pedido como presente e entrega no endereço do presenteado. */
  giftWrapAvailable: boolean
  createdAt: string
  updatedAt: string
  /** Endereço físico da loja, texto livre — presente quando a loja preencheu. */
  address: string | null
  /** Item 14 — loja aceita retirada presencial do pedido. */
  pickupAvailable: boolean
}

export interface ApiNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning'
  href: string | null
  isRead: boolean
  /** Epoch ms. */
  createdAt: number
}

/** Loja de GET /stores — listagem pública (rail "Lojas da cidade"). */
export interface ApiPublicStore {
  id: string
  name: string
  slug: string
  description: string | null
  category: string
  logoUrl: string | null
  giftWrapAvailable: boolean
}

/** Cliente agregado de GET /me/store-customers — CRM básico do lojista. */
export interface ApiStoreCustomer {
  buyerId: string
  name: string
  ordersCount: number
  totalCents: number
  lastOrderAt: string
  lastOrderStatus: ApiOrderStatus
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
  number?: string | null
  complement?: string | null
  /** Bairro/setor — crítico para a entrega; o ViaCEP já devolve em `bairro`. */
  neighborhood?: string | null
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

/** Espelha o enum PaymentStatus do Prisma (`src/server/routes/payments.ts`). */
export type ApiPaymentStatus = 'NONE' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CHARGEDBACK'

export interface ApiOrder {
  id: string
  buyerId: string
  storeId: string
  addressId: string | null
  totalCents: number
  status: ApiOrderStatus
  createdAt: string
  updatedAt: string
  items: ApiOrderItem[]
  /** Ausente em fixtures antigas de teste; a UI trata como 'NONE'. */
  paymentStatus?: ApiPaymentStatus
  /** Item 14 — retirada na loja. Quando true, `addressId` vem nulo do backend. */
  isPickup?: boolean
  /** Item 8 — comprar para presente. addressId acima já é o endereço do presenteado quando isGift=true. */
  isGift?: boolean
  giftRecipientName?: string | null
  giftMessage?: string | null
}

/**
 * Config do Google Pay (2026-08-08), embutida em GET /payments/config.
 * `enabled` e uma feature flag independente da do Pagar.me em si — reflete
 * so a presenca de `PAGARME_ACCOUNT_ID`/`GOOGLE_PAY_GATEWAY_MERCHANT_ID` no
 * servidor (ver src/server/routes/payments.ts). `environment` e o que vai
 * pro SDK do Google (`TEST` nao exige merchant aprovado nem chave real).
 */
export type ApiGooglePayConfig = { enabled: boolean; gatewayMerchantId: string; environment: string }

/**
 * Feature flag por ambiente (2026-08-07): producao nao tera as chaves do
 * Pagar.me ate o go-live de pagamento (dinheiro real) ser decidido. Quando
 * `enabled` e false, o front nem oferece a etapa de pagamento — ver
 * usePaymentCheckoutState.ts e handleFinalizePurchase em useMarketplaceState.ts.
 */
export type ApiPaymentsConfig =
  | { enabled: false; googlePay: ApiGooglePayConfig }
  | { enabled: true; publicKey: string; googlePay: ApiGooglePayConfig }

export interface ApiPaymentCustomer {
  name: string
  email: string
  document: string
  documentType: 'CPF' | 'CNPJ'
  phone?: { countryCode: string; areaCode: string; number: string }
}

export interface ApiBillingAddress {
  line1: string
  line2?: string
  zipCode: string
  city: string
  state: string
  country: string
}

/** Shape do token que sai de `requestGooglePayment` (src/lib/googlePay.ts) — repassado sem alteração ao servidor. */
export interface ApiGooglePayToken {
  protocolVersion: string
  signature: string
  signedMessage: string
  intermediateSigningKey?: unknown
}

export type ApiPayOrderInput =
  | { method: 'pix'; customer: ApiPaymentCustomer }
  | {
      method: 'credit_card'
      customer: ApiPaymentCustomer
      cardToken: string
      installments?: number
      billingAddress?: ApiBillingAddress
    }
  | {
      method: 'google_pay'
      customer: ApiPaymentCustomer
      googlePayToken: ApiGooglePayToken
      installments?: number
      billingAddress?: ApiBillingAddress
    }

export interface ApiPayOrderResponse {
  order: ApiOrder
  pagarmeOrderId: string
  status: string
  pix?: { qrCode: string | null; qrCodeUrl: string | null; expiresAt: string | null }
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

/**
 * Geração do refresh em voo. `handleLogout` chama `invalidateRefresh()`
 * IMEDIATAMENTE depois de `clearStoredSession()`: se um refresh já estava em
 * voo e resolve DEPOIS do logout, a geração capturada no início do refresh
 * não bate mais com a atual — a sessão renovada é descartada em vez de
 * regravar o storage e "ressuscitar" a sessão que acabou de ser encerrada.
 */
let refreshGeneration = 0

export const invalidateRefresh = (): void => {
  refreshGeneration += 1
}

async function refreshSession(): Promise<ApiSession | null> {
  if (refreshPromise) return refreshPromise

  const current = loadStoredSession()
  if (!current?.refreshToken) return null

  // Capturado ANTES do await: é o instantâneo de "geração vigente quando este
  // refresh começou" — comparado no fim para decidir se ainda pode gravar.
  const generationAtStart = refreshGeneration

  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      })
      if (!response.ok) return null
      const payload = (await response.json()) as { session: ApiSession }
      if (generationAtStart !== refreshGeneration) {
        // Logout aconteceu enquanto este refresh estava em voo: a sessão
        // renovada não pode regravar um storage que já foi limpo de propósito.
        return null
      }
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
  /**
   * Bearer explícito, para chamadas feitas DEPOIS que o storage já foi
   * limpo (ex.: logout) — sem isso a chamada sairia sem Authorization porque
   * `loadStoredSession()` já não acha nada.
   */
  token?: string
}

async function request<T>(
  path: string,
  { method = 'GET', body, token }: RequestOptions = {},
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
  else if (token) headers['Authorization'] = `Bearer ${token}`

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
    request<ApiLoginResult>('/auth/login', { method: 'POST', body: input }),

  /**
   * `token` opcional: `handleLogout` captura o access token ANTES de limpar o
   * storage e passa aqui, porque a esta altura `loadStoredSession()` já não
   * acha mais nada (ver `RequestOptions.token`).
   */
  logout: (token?: string) => request<{ ok: true }>('/auth/logout', { method: 'POST', token }),

  forgotPassword: (email: string) =>
    request<{ ok: true }>('/auth/forgot-password', { method: 'POST', body: { email } }),

  resetPassword: (input: { accessToken: string; refreshToken: string; password: string }) =>
    request<{ ok: true }>('/auth/reset-password', { method: 'POST', body: input }),

  /** Monta no servidor a URL de `/auth/v1/authorize` do Supabase — o front nunca tem SUPABASE_URL. */
  oauthUrl: (provider: 'google', redirect: string) =>
    request<{ url: string }>(
      `/auth/oauth-url?provider=${provider}&redirect=${encodeURIComponent(redirect)}`,
    ),

  /** Conclui o login social com os tokens lidos do fragmento de `/entrar/callback`. */
  oauthComplete: (input: { accessToken: string; refreshToken: string; expiresAt?: number }) =>
    request<{ session: ApiSession; user: ApiUser }>('/auth/oauth-complete', {
      method: 'POST',
      body: input,
    }),

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

  listNotifications: () =>
    request<{ notifications: ApiNotification[]; unreadCount: number }>('/me/notifications'),

  markNotificationsRead: () => request<{ ok: true }>('/me/notifications/read', { method: 'POST' }),

  createAddress: (input: {
    label: string
    street: string
    number?: string
    complement?: string
    neighborhood?: string
    city: string
    state: string
    zipCode: string
    latitude: number
    longitude: number
    isDefault?: boolean
  }) => request<{ address: ApiAddress }>('/addresses', { method: 'POST', body: input }),

  listAddresses: () => request<{ addresses: ApiAddress[] }>('/me/addresses'),

  updateAddress: (
    addressId: string,
    input: {
      label: string
      street: string
      number?: string
      complement?: string
      neighborhood?: string
      city: string
      state: string
      zipCode: string
    },
  ) => request<{ address: ApiAddress }>(`/addresses/${addressId}`, { method: 'PATCH', body: input }),

  setDefaultAddress: (addressId: string) =>
    request<{ address: ApiAddress }>(`/addresses/${addressId}/default`, { method: 'PATCH' }),

  deleteAddress: (addressId: string) =>
    request<{ ok: true }>(`/addresses/${addressId}`, { method: 'DELETE' }),

  createOrder: (input: {
    items: Array<{ productId: string; quantity: number }>
    addressId?: string
    isGift?: boolean
    giftRecipientName?: string
    giftMessage?: string
    /** Item 14 — ids das lojas do carrinho escolhidas para retirada; as demais exigem addressId. */
    pickupStoreIds?: string[]
  }) => request<{ orders: ApiOrder[] }>('/orders', { method: 'POST', body: input }),

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
    giftWrapAvailable?: boolean
  }) => request<{ store: ApiStore }>('/stores', { method: 'POST', body: input }),

  /** PATCH parcial da loja (Item 9: toggle "Embalo para presente" no painel do lojista). */
  updateStore: (
    storeId: string,
    input: Partial<{
      name: string
      slug: string
      description: string
      latitude: number
      longitude: number
      category: string
      giftWrapAvailable: boolean
      address: string
      pickupAvailable: boolean
    }>,
  ) => request<{ store: ApiStore }>(`/stores/${storeId}`, { method: 'PATCH', body: input }),

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

  /**
   * PATCH parcial do próprio perfil (nome, telefone, CPF). Campos ausentes
   * mantêm o valor atual; `''` explícito limpa telefone/CPF (mesmo contrato
   * do servidor, ver src/server/routes/me.ts).
   */
  updateMe: (input: { name?: string; phone?: string; document?: string }) =>
    request<{ user: ApiUser }>('/me', { method: 'PATCH', body: input }),

  uploadStoreLogo: (storeId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ store: ApiStore }>(`/me/stores/${storeId}/logo`, { method: 'POST', body: form })
  },

  removeStoreLogo: (storeId: string) =>
    request<{ store: ApiStore }>(`/me/stores/${storeId}/logo`, { method: 'DELETE' }),

  listStoreCustomers: () => request<{ customers: ApiStoreCustomer[] }>('/me/store-customers'),

  // ------------------------------------------------------------ pagamento
  paymentsConfig: () => request<ApiPaymentsConfig>('/payments/config'),

  payOrder: (orderId: string, input: ApiPayOrderInput) =>
    request<ApiPayOrderResponse>(`/orders/${orderId}/pay`, { method: 'POST', body: input }),

  getPaymentStatus: (orderId: string) =>
    request<{ paymentStatus: ApiPaymentStatus; pagarmeOrderId: string | null; platformFeeCents: number | null; storeAmountCents: number | null }>(
      `/orders/${orderId}/payment`,
    ),

  // ------------------------------------------------------------ 2FA (TOTP)
  /** Inicia o enrollment: QR code (data-uri SVG) + secret para digitar manualmente. */
  mfaEnroll: () => request<{ factorId: string; qrCode: string; secret: string }>('/mfa/enroll', { method: 'POST' }),

  /** Confirma o enrollment com o primeiro código do app autenticador. */
  mfaVerify: (input: { factorId: string; code: string }) =>
    request<{ ok: true }>('/mfa/verify', { method: 'POST', body: input }),

  /**
   * Inicia o desafio de login (ou de qualquer outra confirmação, ex.:
   * desativar). `token` só é necessário durante o desafio de LOGIN — a
   * sessão ainda não foi persistida em `loadStoredSession()` nesse momento.
   */
  mfaChallenge: (factorId: string, token?: string) =>
    request<{ challengeId: string }>('/mfa/challenge', { method: 'POST', body: { factorId }, token }),

  /** Conclui o desafio de LOGIN — devolve o mesmo shape de sucesso de `login`. */
  mfaVerifyChallenge: (input: { factorId: string; challengeId: string; code: string }, token?: string) =>
    request<{ session: ApiSession; user: ApiUser }>('/mfa/verify-challenge', {
      method: 'POST',
      body: input,
      token,
    }),

  mfaFactors: () => request<{ factors: ApiMfaFactor[] }>('/mfa/factors'),

  mfaUnenroll: (factorId: string) => request<{ ok: true }>(`/mfa/${factorId}`, { method: 'DELETE' }),
}
