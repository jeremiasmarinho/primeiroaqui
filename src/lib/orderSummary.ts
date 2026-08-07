import { orderStatusLabel, type ApiOrderStatus } from './orderStatus'
import type { Order } from '../types'

/**
 * Derivações client-side do dashboard "Minhas compras" (cards-resumo,
 * agrupamento em andamento/anteriores). Sem endpoint novo — tudo calculado
 * em cima de GET /me/orders já carregado.
 *
 * Pedidos reais trazem `rawStatus` (o enum cru da API, via `toViewOrder`).
 * Pedidos mock/de teste podem não ter `rawStatus`; nesse caso caímos no
 * rótulo pt-BR já calculado (`status`) para não quebrar fixtures antigas.
 */

const IN_PROGRESS_STATUSES: readonly ApiOrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
]

const IN_PROGRESS_LABELS = new Set(IN_PROGRESS_STATUSES.map(orderStatusLabel))
const DELIVERED_LABEL = orderStatusLabel('DELIVERED')
const CANCELED_LABEL = orderStatusLabel('CANCELED')

export const isOrderInProgress = (order: Order): boolean =>
  order.rawStatus
    ? IN_PROGRESS_STATUSES.includes(order.rawStatus as ApiOrderStatus)
    : IN_PROGRESS_LABELS.has(order.status)

export const isOrderDelivered = (order: Order): boolean =>
  order.rawStatus ? order.rawStatus === 'DELIVERED' : order.status === DELIVERED_LABEL

export const isOrderCanceled = (order: Order): boolean =>
  order.rawStatus ? order.rawStatus === 'CANCELED' : order.status === CANCELED_LABEL

export interface OrdersSummary {
  total: number
  inProgress: number
  delivered: number
  /** Soma de `order.value` (reais) dos pedidos não cancelados. */
  totalSpent: number
}

export const summarizeOrders = (orders: Order[]): OrdersSummary => {
  let inProgress = 0
  let delivered = 0
  let totalSpent = 0
  for (const order of orders) {
    if (isOrderInProgress(order)) inProgress += 1
    else if (isOrderDelivered(order)) delivered += 1
    if (!isOrderCanceled(order)) totalSpent += order.value
  }
  return { total: orders.length, inProgress, delivered, totalSpent }
}

export interface GroupedOrders {
  inProgress: Order[]
  previous: Order[]
}

/** Em andamento primeiro (a "entrega" do cliente); o resto vira "Anteriores". */
export const groupOrders = (orders: Order[]): GroupedOrders => {
  const inProgress: Order[] = []
  const previous: Order[] = []
  for (const order of orders) {
    if (isOrderInProgress(order)) inProgress.push(order)
    else previous.push(order)
  }
  return { inProgress, previous }
}
