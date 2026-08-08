import { Gift } from 'lucide-react'
import type { ApiAdminOrder } from '../../lib/api'
import { formatCents } from '../../lib/money'
import {
  canCancelOrder,
  nextOrderStatus,
  orderStatusLabel,
  type ApiOrderStatus,
} from '../../lib/orderStatus'

/** Rótulo da ação que leva ao próximo status — texto de botão, não de estado. */
const ADVANCE_LABELS: Partial<Record<ApiOrderStatus, string>> = {
  CONFIRMED: 'Confirmar',
  PREPARING: 'Preparar',
  READY: 'Pronto',
  DELIVERED: 'Entregar',
}

interface AdminOrdersTabProps {
  orders: ApiAdminOrder[]
  hasMore: boolean
  isLoadingMore: boolean
  pendingOrderIds: Set<string>
  onLoadMore: () => void
  onChangeStatus: (orderId: string, status: ApiOrderStatus) => void
}

/**
 * Pedidos de toda a plataforma: comprador, loja, itens, valor e status, com a
 * transição válida seguinte (máquina de orderStatus.ts) e cancelamento quando
 * ainda permitido. "Carregar mais" pagina contra a API.
 */
export default function AdminOrdersTab({
  orders,
  hasMore,
  isLoadingMore,
  pendingOrderIds,
  onLoadMore,
  onChangeStatus,
}: AdminOrdersTabProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-[24px] border border-line p-6 text-center">
        <h3 className="text-lg font-black text-ink">Nenhum pedido na plataforma</h3>
        <p className="mt-2 text-sm text-ink-muted">
          Quando as lojas começarem a vender, os pedidos aparecem aqui.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-[24px] border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-semibold uppercase tracking-[0.15em] text-ink-muted">
              <th scope="col" className="px-4 py-3">Comprador</th>
              <th scope="col" className="px-4 py-3">Loja</th>
              <th scope="col" className="px-4 py-3">Itens</th>
              <th scope="col" className="px-4 py-3 text-right">Valor</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Presente</th>
              <th scope="col" className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const next = nextOrderStatus(order.status)
              const isPending = pendingOrderIds.has(order.id)
              const itemsSummary = `${order.items.length} item(s) • ${order.items.reduce((sum, item) => sum + item.quantity, 0)} un.`
              return (
                <tr key={order.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3 font-semibold text-ink">{order.buyerName || 'Comprador'}</td>
                  <td className="px-4 py-3 text-ink">{order.storeName}</td>
                  <td className="px-4 py-3 text-ink-muted [font-variant-numeric:tabular-nums]">{itemsSummary}</td>
                  <td className="px-4 py-3 text-right font-semibold text-ink [font-variant-numeric:tabular-nums]">
                    {formatCents(order.totalCents)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-surface-page px-3 py-1 text-xs font-semibold text-ink-muted">
                      {orderStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {order.isGift ? (
                      <span
                        title={order.giftMessage ? `"${order.giftMessage}"` : undefined}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-ink"
                      >
                        <Gift className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {order.giftRecipientName || 'Sim'}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {next ? (
                        <button
                          onClick={() => onChangeStatus(order.id, next)}
                          disabled={isPending}
                          className="btn-primary motion-safe:active:scale-95 min-h-[36px] rounded-[12px] px-3 py-1 text-xs font-semibold transition-transform disabled:opacity-60"
                        >
                          {isPending ? 'Atualizando…' : (ADVANCE_LABELS[next] ?? orderStatusLabel(next))}
                        </button>
                      ) : null}
                      {canCancelOrder(order.status) ? (
                        <button
                          onClick={() => onChangeStatus(order.id, 'CANCELED')}
                          disabled={isPending}
                          className="motion-safe:active:scale-95 min-h-[36px] rounded-[12px] border border-line px-3 py-1 text-xs font-semibold text-ink-muted transition-transform disabled:opacity-60"
                        >
                          {isPending ? 'Atualizando…' : 'Cancelar'}
                        </button>
                      ) : null}
                      {!next && !canCancelOrder(order.status) ? (
                        <span className="text-xs text-ink-muted">—</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {hasMore ? (
        <div className="mt-4 text-center">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="motion-safe:active:scale-95 min-h-[44px] rounded-[16px] border border-line px-6 py-2 text-sm font-semibold text-ink transition-transform disabled:opacity-60"
          >
            {isLoadingMore ? 'Carregando…' : 'Carregar mais pedidos'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
