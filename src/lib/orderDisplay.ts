/**
 * Título e data exibidos de um pedido.
 *
 * Nenhuma tela mostra o UUID cru do pedido (feio e ilegível) — o título
 * padrão é "Pedido #" + os 8 primeiros caracteres do id em maiúsculo, o
 * bastante para diferenciar pedidos numa lista sem virar parede de texto.
 * Usado por OrdersScreen, ProfileScreen e OrderDetailScreen — um lugar só
 * define o formato.
 */

/** Primeiros 8 caracteres do id, maiúsculo — não é um código de verdade, só um jeito curto de citar o pedido. */
export const orderCode = (id: string): string => id.slice(0, 8).toUpperCase()

/** "Pedido #CBDFA2D3". */
export const orderTitle = (id: string): string => `Pedido #${orderCode(id)}`

/** Data pt-BR curta ("06/08/2026"); null quando ausente/inválida — a tela decide se omite. */
export const formatOrderDate = (createdAt?: string): string | null => {
  if (!createdAt) return null
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}
