import { Gift } from 'lucide-react'
import { formatCents } from '../../lib/money'
import {
  canCancelOrder,
  nextOrderStatus,
  orderStatusLabel,
  type ApiOrderStatus,
} from '../../lib/orderStatus'
import type { ApiStoreOrder } from '../../lib/api'

/** Rótulo da ação que leva ao próximo status — texto de botão, não de estado. */
const ADVANCE_LABELS: Partial<Record<ApiOrderStatus, string>> = {
  CONFIRMED: 'Confirmar pedido',
  PREPARING: 'Iniciar preparação',
  READY: 'Marcar como pronto',
  DELIVERED: 'Marcar como entregue',
}

interface OrdersPanelProps {
  orders: ApiStoreOrder[]
  pendingOrderIds: Set<string>
  onChangeStatus: (orderId: string, status: ApiOrderStatus) => void
}

/** Lista de pedidos recebidos, com a ação válida seguinte e cancelamento quando permitido. */
export default function OrdersPanel({ orders, pendingOrderIds, onChangeStatus }: OrdersPanelProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-card border border-line p-6 text-center">
        <h3 className="text-lg font-black text-ink">Nenhum pedido por enquanto</h3>
        <p className="mt-2 text-sm text-ink-muted">
          Quando alguém comprar da sua loja, o pedido aparece aqui para você confirmar e preparar.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {orders.map((order) => {
        const next = nextOrderStatus(order.status)
        const isPending = pendingOrderIds.has(order.id)
        return (
          <li key={order.id} className="rounded-card border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-ink">{order.buyerName || 'Comprador'}</p>
                <p className="text-sm text-ink-muted">
                  {order.items.length} item(s) • {formatCents(order.totalCents)} •{' '}
                  {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <span className="rounded-full bg-surface-page px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-ink-muted">
                {orderStatusLabel(order.status)}
              </span>
            </div>
            {order.isGift ? (
              <div className="mt-3 rounded-[16px] bg-primary/10 p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold text-ink">
                  <Gift className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Presente para {order.giftRecipientName || 'destinatário'}
                </p>
                {order.giftMessage ? <p className="mt-1 text-ink-muted">"{order.giftMessage}"</p> : null}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {next ? (
                <button
                  onClick={() => onChangeStatus(order.id, next)}
                  disabled={isPending}
                  className="btn-primary motion-safe:active:scale-95 min-h-[44px] rounded-[16px] px-4 py-2 text-sm font-semibold transition-transform disabled:opacity-60"
                >
                  {isPending ? 'Atualizando…' : (ADVANCE_LABELS[next] ?? `Avançar para ${orderStatusLabel(next)}`)}
                </button>
              ) : null}
              {canCancelOrder(order.status) ? (
                <button
                  onClick={() => onChangeStatus(order.id, 'CANCELED')}
                  disabled={isPending}
                  className="motion-safe:active:scale-95 min-h-[44px] rounded-[16px] border border-line px-4 py-2 text-sm font-semibold text-ink-muted transition-transform disabled:opacity-60"
                >
                  {isPending ? 'Atualizando…' : 'Cancelar pedido'}
                </button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
