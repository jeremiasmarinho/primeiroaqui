/**
 * Tipos de domínio do Primeiro Aqui.
 *
 * Fonte única de verdade para o formato dos dados. Nenhum arquivo deve
 * redeclarar estas formas — importar daqui.
 */

/** Papéis reais do backend (Prisma enum Role). O antigo 'client'/'admin' morreu na integração. */
export type Role = 'BUYER' | 'STORE_OWNER' | 'ADMIN'

/**
 * Categoria agora é string aberta: o backend guarda categoria livre e a lista
 * real é derivada do catálogo carregado. 'Tudo' segue como sentinela de
 * "sem filtro" na vitrine.
 */
export type Category = string

export interface Product {
  /** UUID do backend. Ids numéricos do mock antigo viraram strings. */
  id: string
  title: string
  price: number
  listPrice: number
  seller: string
  rating: number
  reviews: number
  sold: number
  category: Exclude<Category, 'Tudo'>
  freeShipping: boolean
  express: boolean
  arrival: string
  image: string
  bestSeller?: boolean
  /** Loja dona do produto (uuid) — presente quando o produto veio da API. */
  storeId?: string
  /** Estoque informado pela API; ausente nos dados de demonstração. */
  stock?: number
}

export interface CartItem {
  product: Product
  quantity: number
}

export interface CartState {
  items: CartItem[]
}

export type CartAction =
  | { type: 'ADD_TO_CART'; payload: Product }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'SET_QUANTITY'; payload: { productId: string; quantity: number } }
  | { type: 'REPLACE_CART'; payload: CartItem[] }
  | { type: 'CLEAR_CART' }

/** Status do fluxo mock do painel admin (Tracking/AdminScreen, ainda não migrados). */
export type OrderStatus = 'Processando' | 'Em rota' | 'Entregue'

/**
 * Linha do pedido: guarda o que foi comprado e quanto, sem congelar preço.
 * `items` (só títulos) serve para exibir; `lines` é o que permite recomprar.
 */
export interface OrderLine {
  productId: string
  quantity: number
}

export interface Order {
  id: string
  customer: string
  agent: string
  value: number
  /**
   * Rótulo pt-BR exibido. Pedidos reais usam `src/lib/orderStatus.ts`;
   * pedidos mock do painel admin seguem o union `OrderStatus`.
   */
  status: string
  region: string
  items?: string[]
  lines?: OrderLine[]
  address?: string
  payment?: PaymentMethod
  couponCode?: string
  discount?: number
}

export type PaymentMethod = 'Pix' | 'Cartão' | 'Boleto'

export interface DeliveryForm {
  name: string
  address: string
  city: string
  cep: string
  payment: PaymentMethod
}

export type AgentStatus = 'Disponível' | 'Ativo' | 'Offline'

export interface Agent {
  id: number
  name: string
  region: string
  specialty: string
  status: AgentStatus
  commission: number
}

export interface User {
  /** Id do backend (uuid). Ausente no atalho de login de desenvolvimento. */
  id?: string
  name: string
  email: string
  role: Role
}

export interface Store {
  id: string
  slug: string
  name: string
  category: Exclude<Category, 'Tudo'>
  rating: number
  deliveries: number
  neighborhood: string
  cover: string
}

export interface Customer {
  id: string
  name: string
  neighborhood: string
  orders: number
  avatar: string
}

export interface Review {
  id: string
  productId: string
  customerId: string
  rating: number
  comment: string
  date: string
}

export interface Address {
  id: string
  label: string
  street: string
  city: string
  cep: string
  isDefault: boolean
}

export type CouponKind = 'percent' | 'fixed'

export interface Coupon {
  code: string
  kind: CouponKind
  value: number
  minSubtotal: number
  /** ISO date; a validade é comparada contra um `now` injetado, nunca Date.now(). */
  expiresAt: string
  description: string
}

export interface Notification {
  id: number
  title: string
  message: string
  type: 'info' | 'success' | 'warning'
}

export interface ThreadMessage {
  id: number
  text: string
  from: 'user' | 'agent'
  time: string
}

export interface Thread {
  id: number
  participant: string
  role: string
  status: string
  unread: number
  messages: ThreadMessage[]
}

export interface ScheduleItem {
  id: number
  title: string
  time: string
  agent: string
  status: string
}

export interface BusinessProfile {
  name: string
  category: string
  address: string
  phone: string
}
