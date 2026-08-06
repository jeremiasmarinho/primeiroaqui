/**
 * Mapeamento único do enum de status de pedido do backend para rótulos
 * pt-BR. Nenhuma tela traduz status por conta própria — mudou o rótulo,
 * muda um arquivo.
 */

export const API_ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DELIVERED',
  'CANCELED',
] as const

export type ApiOrderStatus = (typeof API_ORDER_STATUSES)[number]

const LABELS: Record<ApiOrderStatus, string> = {
  PENDING: 'Aguardando confirmação',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Em preparação',
  READY: 'Pronto para entrega',
  DELIVERED: 'Entregue',
  CANCELED: 'Cancelado',
}

/**
 * Rótulo pt-BR de um status vindo da API. Status desconhecido (enum novo no
 * back antes do deploy do front) degrada para o valor cru em vez de quebrar.
 */
export const orderStatusLabel = (status: string): string =>
  (LABELS as Record<string, string>)[status] ?? status

/**
 * Máquina de estados do pedido — fonte única usada tanto pelo servidor
 * (PATCH /orders/:id/status) quanto pela UI do lojista (botão de avançar).
 * Fluxo feliz: PENDING → CONFIRMED → PREPARING → READY → DELIVERED.
 * CANCELED só é alcançável a partir de PENDING/CONFIRMED.
 */
export const ORDER_STATUS_TRANSITIONS: Record<ApiOrderStatus, readonly ApiOrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELED'],
  CONFIRMED: ['PREPARING', 'CANCELED'],
  PREPARING: ['READY'],
  READY: ['DELIVERED'],
  DELIVERED: [],
  CANCELED: [],
}

export const isValidOrderTransition = (from: ApiOrderStatus, to: ApiOrderStatus): boolean =>
  ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false

/** Próximo status do fluxo feliz (nunca CANCELED); null quando o pedido é terminal. */
export const nextOrderStatus = (status: ApiOrderStatus): ApiOrderStatus | null =>
  ORDER_STATUS_TRANSITIONS[status]?.find((candidate) => candidate !== 'CANCELED') ?? null

/** O lojista pode cancelar? Só enquanto o pedido não entrou em preparação. */
export const canCancelOrder = (status: ApiOrderStatus): boolean =>
  ORDER_STATUS_TRANSITIONS[status]?.includes('CANCELED') ?? false
