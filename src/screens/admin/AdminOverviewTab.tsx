import type { ApiAdminMetrics } from '../../lib/api'
import { formatCents } from '../../lib/money'
import { API_ORDER_STATUSES, orderStatusLabel } from '../../lib/orderStatus'

interface AdminOverviewTabProps {
  metrics: ApiAdminMetrics
}

const numberBR = new Intl.NumberFormat('pt-BR')

/** "2026-08-06" → "06/08" (rótulo curto do eixo do gráfico). */
const shortDay = (isoDate: string): string => {
  const [, month, day] = isoDate.split('-')
  return `${day}/${month}`
}

/**
 * Visão geral da plataforma: cards de totais, distribuição de pedidos por
 * status e a série de 30 dias de pedidos/GMV. Gráfico em divs puras com os
 * tokens do design system — sem lib de chart.
 */
export default function AdminOverviewTab({ metrics }: AdminOverviewTabProps) {
  const { totals, ordersByStatus, last30Days } = metrics

  const cards = [
    { label: 'Usuários', value: numberBR.format(totals.users) },
    { label: 'Lojas ativas / total', value: `${numberBR.format(totals.activeStores)} / ${numberBR.format(totals.stores)}` },
    { label: 'Produtos', value: numberBR.format(totals.products) },
    { label: 'Pedidos', value: numberBR.format(totals.orders) },
    { label: 'GMV', value: formatCents(totals.gmvCents) },
  ]

  const statusRows = API_ORDER_STATUSES.map((status) => ({
    status,
    count: ordersByStatus[status] ?? 0,
  }))
  const maxStatus = Math.max(1, ...statusRows.map((row) => row.count))

  const maxDailyOrders = Math.max(1, ...last30Days.map((day) => day.orders))
  const totalRecentOrders = last30Days.reduce((sum, day) => sum + day.orders, 0)
  const totalRecentGmv = last30Days.reduce((sum, day) => sum + day.gmvCents, 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-[20px] bg-surface-page p-4">
            <p className="text-sm text-ink-muted">{card.label}</p>
            <p className="text-2xl font-black tabular text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      <section aria-label="Pedidos por status" className="rounded-[24px] border border-line p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-ink-muted">
          Pedidos por status
        </h2>
        <ul className="mt-3 space-y-2">
          {statusRows.map((row) => (
            <li key={row.status} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3">
              <span className="truncate text-sm text-ink">{orderStatusLabel(row.status)}</span>
              <div className="h-3 overflow-hidden rounded-full bg-surface-page" role="presentation">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(row.count / maxStatus) * 100}%` }}
                />
              </div>
              <span className="text-right text-sm font-semibold tabular text-ink">
                {numberBR.format(row.count)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Pedidos nos últimos 30 dias" className="rounded-[24px] border border-line p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-ink-muted">
            Últimos 30 dias
          </h2>
          <p className="text-sm tabular text-ink-muted">
            {numberBR.format(totalRecentOrders)} pedido(s) • {formatCents(totalRecentGmv)} em GMV
          </p>
        </div>
        {/* Barras diárias de pedidos; o title de cada barra carrega o detalhe (data, pedidos, GMV). */}
        <div className="mt-4 flex h-32 items-end gap-[2px] border-b border-line pb-px" role="img" aria-label={`Pedidos por dia nos últimos 30 dias, pico de ${maxDailyOrders} pedido(s)`}>
          {last30Days.map((day) => (
            <div
              key={day.date}
              title={`${shortDay(day.date)}: ${day.orders} pedido(s), ${formatCents(day.gmvCents)}`}
              className={`min-h-[2px] flex-1 rounded-t-sm ${day.orders > 0 ? 'bg-primary' : 'bg-surface-page'}`}
              style={{ height: `${Math.max(2, (day.orders / maxDailyOrders) * 100)}%` }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs tabular text-ink-muted">
          <span>{shortDay(last30Days[0]?.date ?? '')}</span>
          <span>{shortDay(last30Days[last30Days.length - 1]?.date ?? '')}</span>
        </div>
      </section>
    </div>
  )
}
