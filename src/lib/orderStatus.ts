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
