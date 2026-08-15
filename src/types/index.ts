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
  /** Item 9 — a loja dona deste produto embala para presente; alimenta o toggle "É um presente?" no checkout. */
  storeGiftWrapAvailable?: boolean
  /** Item 14 — a loja dona deste produto aceita retirada presencial; alimenta a opção "Retirar na loja" no checkout. */
  storePickupAvailable?: boolean
  /** Endereço físico da loja para retirada (texto livre), quando cadastrado. */
  storePickupAddress?: string | null
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

/** Linha de item com preço, para a tela de detalhe (`OrderDetailScreen`) — `items`/`lines` bastam para o card resumido, mas o detalhe mostra preço por linha. */
export interface OrderItemLine {
  title: string
  quantity: number
  unitPrice: number
  lineTotal: number
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
  /** Status cru da API (`ApiOrderStatus`), quando o pedido veio de lá — permite agrupar sem reinterpretar o rótulo pt-BR. */
  rawStatus?: string
  region: string
  items?: string[]
  lines?: OrderLine[]
  address?: string
  payment?: PaymentMethod
  couponCode?: string
  discount?: number
  /** Loja dona do pedido (uuid) — presente quando o pedido veio da API. */
  storeId?: string
  /** Nome da loja, resolvido no adaptador a partir do catálogo carregado; ausente quando a loja não foi encontrada. */
  storeName?: string
  /** Status do pagamento (`ApiPaymentStatus`); 'NONE' quando o pedido ainda não tentou pagar. */
  paymentStatus?: string
  /** Data de criação (ISO), quando o pedido veio da API — alimenta o título formatado e a tela de detalhe. */
  createdAt?: string
  /** Itens com preço por linha, para a tela de detalhe. Ausente em pedidos mock do painel admin. */
  itemLines?: OrderItemLine[]
  /** Item 14 — retirada na loja. Quando true, o pedido não tem endereço de entrega. */
  isPickup?: boolean
  /** Item 8 — comprar para presente. Quando true, `address` é o endereço do presenteado. */
  isGift?: boolean
  giftRecipientName?: string | null
  giftMessage?: string | null
}

// Boleto removido por decisão de negócio (2026-08-07): apenas Pix e cartão
// (crédito/débito) — alinhado aos métodos suportados na integração Pagar.me.
export type PaymentMethod = 'Pix' | 'Cartão'

export interface DeliveryForm {
  name: string
  address: string
  city: string
  cep: string
  payment: PaymentMethod
  /** Item 14 — retirada na loja. Só pode ser marcado se a loja do carrinho tiver pickupAvailable; dispensa endereço de entrega. */
  isPickup: boolean
  /** Item 8 — comprar para presente. Só pode ser marcado se a loja do carrinho tiver giftWrapAvailable. */
  isGift: boolean
  giftRecipientName: string
  giftMessage: string
}

export interface User {
  /** Id do backend (uuid). Ausente no atalho de login de desenvolvimento. */
  id?: string
  name: string
  email: string
  role: Role
  /** Foto de perfil (URL publica do bucket `avatars`); null/ausente mostra iniciais. */
  avatarUrl?: string | null
  /** Telefone e CPF cadastrados no perfil (Item 3) — pré-preenchem o checkout. */
  phone?: string | null
  document?: string | null
}

export interface Store {
  id: string
  slug: string
  name: string
  category: Exclude<Category, 'Tudo'>
  /** Categoria real da loja (`StoreCategory` do backend, ex.: "MERCADO") — ver src/lib/storeCategory.ts. */
  storeCategory?: string
  rating: number
  deliveries: number
  neighborhood: string
  cover: string
  /** Logo circular da loja, quando cadastrado — null/undefined cai no fallback (cover/iniciais). */
  logoUrl?: string | null
  /** Item 9 — loja embala o pedido como presente e entrega no endereço do presenteado. */
  giftWrapAvailable?: boolean
  /** Item 14 — loja aceita retirada presencial do pedido. */
  pickupAvailable?: boolean
  /** Endereço físico da loja (texto livre), quando cadastrado. */
  address?: string | null
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
  /** Ausente em endereços legados cadastrados antes do campo existir. */
  number?: string
  complement?: string
  /** Bairro/setor — crítico para a entrega; ausente em endereços legados. */
  neighborhood?: string
  city: string
  /** UF — necessário para reabrir o form de edição já preenchido. */
  state?: string
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
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning'
  /** Destino ao clicar (rota interna). Sem href, o item não é clicável. */
  href?: string
  /** Epoch ms de criação, usado pelo cronômetro do painel. */
  createdAt: number
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

export interface BusinessProfile {
  name: string
  category: string
  address: string
  phone: string
}
