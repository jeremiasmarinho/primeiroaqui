import { PackageSearch, RotateCcw } from 'lucide-react'
import { Link } from 'wouter'

import BottomNav from '../components/BottomNav'
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  ScreenHeader,
  itemsLabel,
} from '../components/ScreenShell'
import { formatCurrency } from '../lib/format'
import { ROUTES } from '../router/routes'
import type { Order } from '../types'

interface OrdersScreenProps {
  orders: Order[]
  onRepeatOrder: (order: Order) => void
  onOpenCart: () => void
  cartCount: number
  favoritesCount: number
  repeatError?: string
  moreHref?: string
  isLoading?: boolean
  error?: string
}

/**
 * Histórico de pedidos.
 *
 * O acompanhamento continua em `/pedido/:id` (TrackingScreen): aqui só há o
 * link para lá, sem duplicar a tela de rastreio.
 */
export default function OrdersScreen({
  orders,
  onRepeatOrder,
  onOpenCart,
  cartCount,
  favoritesCount,
  repeatError = '',
  moreHref,
  isLoading = false,
  error = '',
}: OrdersScreenProps) {
  const body = () => {
    if (isLoading) return <LoadingBlock label="Carregando seus pedidos…" />
    if (error) return <ErrorBlock message={error} />
    if (orders.length === 0) {
      return (
        <EmptyBlock
          Icon={PackageSearch}
          title="Nenhum pedido por aqui"
          message="Quando você finalizar uma compra, ela aparece nesta lista com status e valores."
        />
      )
    }

    return (
      <ul aria-label="Pedidos" className="grid gap-3">
        {orders.map((order) => (
          <li key={order.id} className="rounded-card bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-base font-bold text-ink">{order.id}</p>
              <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-micro font-bold uppercase tracking-wide text-ink-muted">
                {order.status}
              </span>
            </div>

            <p className="mt-1 text-sm leading-6 text-ink-muted">
              {order.items?.length ? order.items.join(', ') : 'Itens não registrados neste pedido.'}
            </p>
            <p className="tabular mt-1 font-display text-lg font-black text-ink">
              {formatCurrency(order.value)}
            </p>
            <p className="text-micro text-ink-faint">
              {order.payment ?? 'Pix'} · {order.address ?? order.region}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={ROUTES.order(order.id)}
                aria-label={`Acompanhar pedido ${order.id}`}
                className="inline-flex min-h-[44px] items-center rounded-full bg-ink px-4 text-sm
                           font-bold text-white transition-transform duration-150 motion-safe:active:scale-95"
              >
                Acompanhar
              </Link>
              <button
                type="button"
                onClick={() => onRepeatOrder(order)}
                aria-label={`Repetir pedido ${order.id}`}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-line
                           px-4 text-sm font-bold text-ink transition-colors duration-150 hover:bg-surface-sunken"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Repetir pedido
              </button>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="min-h-dvh bg-surface-page pb-nav">
      <ScreenHeader title="Meus pedidos" count={itemsLabel(orders.length)} />
      <main className="mx-auto max-w-3xl px-3 py-4">
        {repeatError ? (
          <p
            role="alert"
            className="mb-3 rounded-card bg-surface p-3 text-sm font-bold text-promo shadow-card"
          >
            {repeatError}
          </p>
        ) : null}
        {body()}
      </main>
      <BottomNav
        active="more"
        cartCount={cartCount}
        favoritesCount={favoritesCount}
        moreHref={moreHref}
        onNavigate={onOpenCart}
      />
    </div>
  )
}
