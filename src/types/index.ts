/**
 * Tipos de domínio do Primeiro Aqui.
 *
 * Fonte única de verdade para o formato dos dados. Nenhum arquivo deve
 * redeclarar estas formas — importar daqui.
 */

export type Role = 'client' | 'admin'

export type Category = 'Tudo' | 'Supermercado' | 'Farmácia' | 'Casa' | 'Eletrônico'

export interface Product {
  id: number
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
  | { type: 'REMOVE_FROM_CART'; payload: number }
  | { type: 'SET_QUANTITY'; payload: { productId: number; quantity: number } }
  | { type: 'CLEAR_CART' }

export type OrderStatus = 'Processando' | 'Em rota' | 'Entregue'

export interface Order {
  id: string
  customer: string
  agent: string
  value: number
  status: OrderStatus
  region: string
  items?: string[]
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
  productId: number
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
