import { formatCents } from '../../lib/money'
import { orderStatusLabel } from '../../lib/orderStatus'
import type { ApiStoreCustomer } from '../../lib/api'

interface StoreCustomersPanelProps {
  customers: ApiStoreCustomer[]
}

const relativeFormatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

/** Data relativa pt-BR ("há 3 dias", "hoje", "há 2 meses") a partir de um ISO string. */
const relativeDate = (iso: string): string => {
  const date = new Date(iso)
  const diffMs = date.getTime() - Date.now()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'hoje'
  if (Math.abs(diffDays) < 30) return relativeFormatter.format(diffDays, 'day')

  const diffMonths = Math.round(diffDays / 30)
  if (Math.abs(diffMonths) < 12) return relativeFormatter.format(diffMonths, 'month')

  const diffYears = Math.round(diffMonths / 12)
  return relativeFormatter.format(diffYears, 'year')
}

/** Aba "Clientes" do painel do lojista: quem já comprou, agregado por comprador. */
export default function StoreCustomersPanel({ customers }: StoreCustomersPanelProps) {
  if (customers.length === 0) {
    return (
      <div className="rounded-card border border-line p-6 text-center">
        <h3 className="font-display text-lg font-black text-ink">Nenhum cliente por enquanto</h3>
        <p className="mt-2 text-sm text-ink-muted">Suas vendas aparecem aqui assim que o primeiro pedido for concluído.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {customers.map((customer) => (
        <li key={customer.buyerId} className="rounded-card border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold text-ink">{customer.name}</p>
              <p className="text-sm text-ink-muted">
                <span className="tabular">{customer.ordersCount}</span> pedido(s) •{' '}
                <span className="tabular">{formatCents(customer.totalCents)}</span>
              </p>
            </div>
            <span className="rounded-full bg-surface-page px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-ink-muted">
              {orderStatusLabel(customer.lastOrderStatus)}
            </span>
          </div>
          <p className="mt-2 text-xs text-ink-faint">Última compra {relativeDate(customer.lastOrderAt)}</p>
        </li>
      ))}
    </ul>
  )
}
