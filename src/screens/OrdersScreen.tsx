import { PackageSearch, RotateCcw } from 'lucide-react'
import { Link } from 'wouter'

import BottomNav from '../components/BottomNav'
import { PaymentStatusChip } from '../components/PaymentStatusChip'
import { EmptyBlock, ScreenHeader, itemsLabel } from '../components/ScreenShell'
import { formatCurrency } from '../lib/format'
import { formatOrderDate, orderTitle } from '../lib/orderDisplay'
import { groupOrders, isOrderInProgress, summarizeOrders } from '../lib/orderSummary'
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
  onRetry?: () => void
}

/** Skeleton na grade real (mesmo formato dos cards), não uma caixa de texto genérica. */
function OrdersSkeleton() {
  return (
    <div role="status" aria-busy="true" className="grid gap-3">
      <span className="sr-only">Carregando seus pedidos…</span>
      {[0, 1, 2].map((index) => (
        <div key={index} aria-hidden="true" className="animate-pulse rounded-card bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <div className="h-4 w-24 rounded bg-surface-sunken" />
            <div className="h-4 w-16 rounded-full bg-surface-sunken" />
          </div>
          <div className="mt-3 h-3 w-3/4 rounded bg-surface-sunken" />
          <div className="mt-2 h-4 w-20 rounded bg-surface-sunken" />
        </div>
      ))}
    </div>
  )
}

/** Grade de cards-resumo do topo. Sem endpoint novo: tudo derivado dos pedidos já carregados. */
function SummaryRow({ orders }: { orders: Order[] }) {
  const summary = summarizeOrders(orders)
  const tiles = [
    { label: 'Total de pedidos', value: String(summary.total) },
    { label: 'Em andamento', value: String(summary.inProgress) },
    { label: 'Entregues', value: String(summary.delivered) },
    { label: 'Total gasto', value: formatCurrency(summary.totalSpent) },
  ]

  return (
    <ul aria-label="Resumo das compras" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map((tile) => (
        <li key={tile.label} className="rounded-card bg-surface p-3 shadow-card">
          <p className="text-micro font-bold uppercase tracking-wide text-ink-muted">{tile.label}</p>
          <p className="tabular mt-1 font-display text-lg font-black text-ink">{tile.value}</p>
        </li>
      ))}
    </ul>
  )
}

function OrderCard({
  order,
  highlightStatus,
  onRepeatOrder,
}: {
  order: Order
  highlightStatus: boolean
  onRepeatOrder: (order: Order) => void
}) {
  const title = orderTitle(order.id)
  const date = formatOrderDate(order.createdAt)

  return (
    <li
      className="relative cursor-pointer rounded-card bg-surface p-4 shadow-card transition-transform
                 duration-150 motion-safe:active:scale-[0.98]"
    >
      {/* Card inteiro é o alvo de toque (padrão "stretched link"): o Link cobre
          a área toda em z-0; "Repetir pedido" fica acima (z-10) e não é filho
          do <a>, então o clique nele não navega — sem precisar de nested
          <button> dentro de <a>. */}
      <Link
        href={ROUTES.order(order.id)}
        aria-label={`Ver detalhes do ${title}`}
        className="absolute inset-0 z-0 rounded-card"
      />

      <div className="pointer-events-none relative z-[1]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-base font-bold text-ink">{title}</p>
            {order.storeName || date ? (
              <p className="text-micro text-ink-faint">
                {[order.storeName, date].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={
                highlightStatus
                  ? 'rounded-full bg-brand px-2 py-0.5 text-micro font-bold uppercase tracking-wide text-navy'
                  : 'rounded-full bg-surface-sunken px-2 py-0.5 text-micro font-bold uppercase tracking-wide text-ink-muted'
              }
            >
              {order.status}
            </span>
            <PaymentStatusChip paymentStatus={order.paymentStatus} />
          </div>
        </div>

        <p className="mt-1 text-sm leading-6 text-ink-muted">
          {order.items?.length ? order.items.join(', ') : 'Itens não registrados neste pedido.'}
        </p>
        <p className="tabular mt-1 font-display text-lg font-black text-ink">
          {formatCurrency(order.value)}
        </p>
        {order.address || order.region ? (
          <p className="text-micro text-ink-faint">
            {order.payment ?? 'Pix'} · {order.address ?? order.region}
          </p>
        ) : (
          <p className="text-micro text-ink-faint">{order.payment ?? 'Pix'}</p>
        )}
      </div>

      <div className="relative z-10 mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRepeatOrder(order)
          }}
          aria-label={`Repetir pedido ${order.id}`}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-full border border-line
                     px-4 text-sm font-bold text-ink transition-colors duration-150 hover:bg-surface-sunken"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Repetir pedido
        </button>
      </div>
    </li>
  )
}

/**
 * Dashboard "Minhas compras".
 *
 * Cada card é um link para `/pedido/:id` (OrderDetailScreen — a tela de
 * detalhe real, ver src/screens/OrderDetailScreen.tsx), com "Repetir pedido"
 * como ação separada dentro do card.
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
  onRetry,
}: OrdersScreenProps) {
  const body = () => {
    if (isLoading) return <OrdersSkeleton />
    if (error) {
      return (
        <div className="rounded-card bg-surface p-8 text-center shadow-card">
          <p role="alert" className="text-sm font-bold text-error">
            {error}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Tente de novo em instantes. Suas informações continuam salvas.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="btn-primary min-h-[44px] mt-4 motion-safe:active:scale-95"
          >
            Tentar de novo
          </button>
        </div>
      )
    }
    if (orders.length === 0) {
      return (
        <EmptyBlock
          Icon={PackageSearch}
          title="Nenhum pedido por aqui"
          message="Quando você finalizar uma compra, ela aparece nesta lista com status e valores."
        />
      )
    }

    const { inProgress, previous } = groupOrders(orders)

    return (
      <div className="grid gap-5">
        <SummaryRow orders={orders} />

        {inProgress.length > 0 ? (
          <section aria-label="Pedidos em andamento">
            <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-ink-muted">
              Em andamento
            </h2>
            <ul aria-label="Pedidos em andamento" className="grid gap-3">
              {inProgress.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  highlightStatus={isOrderInProgress(order)}
                  onRepeatOrder={onRepeatOrder}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {previous.length > 0 ? (
          <section aria-label="Pedidos anteriores">
            <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-ink-muted">
              Anteriores
            </h2>
            <ul aria-label="Pedidos anteriores" className="grid gap-3">
              {previous.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  highlightStatus={false}
                  onRepeatOrder={onRepeatOrder}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-surface-page pb-nav">
      <ScreenHeader title="Minhas compras" count={itemsLabel(orders.length)} />
      <main className="mx-auto max-w-3xl px-3 py-4">
        <div className="mb-4 flex items-center gap-2">
          <img
            src="/brand/pin.png"
            alt=""
            aria-hidden="true"
            width={244}
            height={321}
            className="h-8 w-auto"
          />
          <p aria-hidden="true" className="font-display text-xl font-black text-ink">
            Minhas compras
          </p>
        </div>

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
