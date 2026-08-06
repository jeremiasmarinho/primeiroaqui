import type {
  CartItem,
  CartState,
  DeliveryForm,
  Order,
  OrderStatus,
  Product,
  Role,
} from '../types'

export const ORDER_STATUS = {
  PROCESSING: 'Processando',
  IN_ROUTE: 'Em rota',
  DELIVERED: 'Entregue',
} as const satisfies Record<string, OrderStatus>

const statusTransitions: Record<OrderStatus, OrderStatus[]> = {
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.IN_ROUTE],
  [ORDER_STATUS.IN_ROUTE]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
}

const parseOrderNumber = (orderId: string): number => {
  const numeric = Number.parseInt(String(orderId).replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(numeric) ? numeric : 1000
}

/**
 * Gerador de ID monotonico a partir do maior pedido existente. Injetado em
 * `createOrder` para o teste controlar a sequencia sem depender de relogio.
 */
export const createOrderIdGenerator = (existingOrders: Pick<Order, 'id'>[]): (() => string) => {
  let current = existingOrders.reduce((max, order) => {
    const number = parseOrderNumber(order.id)
    return number > max ? number : max
  }, 1000)

  return () => {
    current += 1
    return String(current)
  }
}

export interface CreateOrderInput {
  cartState: CartState
  delivery: DeliveryForm
  agentName?: string
  role: Role
  idGenerator: () => string
  discount?: number
  couponCode?: string
}

export const createOrder = ({
  cartState,
  delivery,
  agentName,
  role,
  idGenerator,
  discount = 0,
  couponCode,
}: CreateOrderInput): Order => {
  const subtotal = cartState.items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  )

  // O desconto nunca pode deixar o pedido negativo.
  const value = Math.max(0, subtotal - discount)

  return {
    id: idGenerator(),
    customer: delivery.name || (role === 'ADMIN' ? 'Operador' : 'Cliente'),
    agent: agentName || 'Agente',
    value,
    items: cartState.items.map((item) => item.product.title),
    lines: cartState.items.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
    })),
    payment: delivery.payment || 'Pix',
    status: ORDER_STATUS.PROCESSING,
    region: delivery.city || 'Centro',
    ...(delivery.address ? { address: delivery.address } : {}),
    ...(couponCode ? { couponCode, discount } : {}),
  }
}

export type RepeatOrderResult =
  | { ok: true; items: CartItem[] }
  | { ok: false; message: string }

/**
 * Monta o carrinho de "repetir pedido".
 *
 * O preço vem sempre do catálogo atual, nunca do histórico: recomprar um
 * pedido de meses atrás com o preço congelado seria cobrar errado. Se algum
 * produto saiu do ar, a operação inteira falha — carrinho pela metade é pior
 * que recusa explicada.
 */
export const repeatOrder = (order: Order, catalog: Product[]): RepeatOrderResult => {
  const lines = order.lines ?? []

  if (lines.length === 0) {
    return {
      ok: false,
      message: 'Este pedido não guarda os itens comprados. Adicione os produtos manualmente.',
    }
  }

  const items: CartItem[] = []
  for (const line of lines) {
    const product = catalog.find((item) => item.id === line.productId)
    if (!product) {
      return {
        ok: false,
        message: 'Um dos produtos deste pedido saiu do catálogo. Confira as ofertas atuais.',
      }
    }
    items.push({ product, quantity: line.quantity })
  }

  return { ok: true, items }
}

export const changeOrderStatus = (order: Order, nextStatus: OrderStatus): Order => {
  // `status` agora é string aberta (pedidos reais têm rótulos próprios);
  // este fluxo só vale para os três status do mock admin.
  const allowed = (statusTransitions as Record<string, OrderStatus[]>)[order.status] ?? []

  if (!allowed.includes(nextStatus)) {
    throw new Error(`Transicao invalida: ${order.status} -> ${nextStatus}`)
  }

  return { ...order, status: nextStatus }
}
