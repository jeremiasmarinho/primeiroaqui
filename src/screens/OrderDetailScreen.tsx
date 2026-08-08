import { ArrowLeft, Gift, PackageSearch, Store as StoreIcon } from 'lucide-react'
import { Link } from 'wouter'

import EmptyState from '../components/EmptyState'
import { PaymentStatusChip, paymentStatusLabel } from '../components/PaymentStatusChip'
import { formatCurrency } from '../lib/format'
import { formatOrderDate, orderTitle } from '../lib/orderDisplay'
import { ROUTES } from '../router/routes'
import type { Order } from '../types'

interface OrderDetailScreenProps {
  orderId: string
  orders: Order[]
  isLoading?: boolean
  error?: string
}

/** Cabeçalho com marca (pin) e voltar para /pedidos — mesmo padrão de ProductScreen/StoreScreen. */
function Header({ title }: { title: string }) {
  return (
    <header className="safe-top sticky top-0 z-30 flex items-center gap-2 bg-brand px-3 py-2">
      <Link
        href={ROUTES.orders}
        aria-label="Voltar a Minhas compras"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-navy transition-colors duration-150 hover:bg-brand-deep"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </Link>
      <img src="/brand/pin.png" alt="" aria-hidden="true" width={244} height={321} className="h-6 w-auto" />
      <h1 className="truncate text-sm font-bold text-navy">{title}</h1>
    </header>
  )
}

/**
 * Detalhe de um pedido — nasceu do feedback direto do usuário em "Minhas
 * compras": os cards não eram clicáveis e o título era o UUID cru. A rota
 * `/pedido/:id` (ROUTE_PATTERNS.order) foi reativada para esta tela nova, no
 * lugar do antigo redirecionamento para `/pedidos` (o TrackingScreen mock
 * que existia aqui antes não conhecia pedidos reais da API).
 *
 * Fonte de dados: reaproveita `orders` (GET /me/orders, já carregado no
 * mount do app para toda sessão autenticada — ver useMarketplaceState) em
 * vez de buscar de novo; evita endpoint novo e mantém a mesma "verdade" que
 * o dashboard já mostra. Pedido que não está na lista (não existe OU é de
 * outro usuário — a API só devolve pedidos do dono) cai no EmptyState
 * "Pedido não encontrado", sem distinguir os dois casos: o servidor nunca
 * revela a existência de pedido alheio.
 */
export default function OrderDetailScreen({ orderId, orders, isLoading = false, error = '' }: OrderDetailScreenProps) {
  const order = orders.find((candidate) => candidate.id === orderId)

  if (isLoading && !order) {
    return (
      <div className="min-h-dvh bg-surface-page pb-nav">
        <Header title="Pedido" />
        <main className="mx-auto max-w-3xl px-3 py-4">
          <div
            role="status"
            aria-busy="true"
            aria-label="Carregando pedido…"
            className="animate-pulse rounded-card bg-surface p-6 shadow-card"
          >
            <div className="h-5 w-40 rounded bg-surface-sunken" />
            <div className="mt-3 h-4 w-24 rounded bg-surface-sunken" />
            <div className="mt-6 h-4 w-full rounded bg-surface-sunken" />
            <div className="mt-2 h-4 w-2/3 rounded bg-surface-sunken" />
          </div>
        </main>
      </div>
    )
  }

  if (!order) {
    if (error) {
      return (
        <div className="min-h-dvh bg-surface-page pb-nav">
          <Header title="Pedido" />
          <main className="mx-auto max-w-3xl px-3 py-4">
            <div className="rounded-card bg-surface p-8 text-center shadow-card">
              <p role="alert" className="text-sm font-bold text-error">
                {error}
              </p>
            </div>
          </main>
        </div>
      )
    }
    return (
      <EmptyState
        Icon={PackageSearch}
        title="Pedido não encontrado"
        message="Este pedido não existe ou não pertence à sua conta."
        actionLabel="Ver minhas compras"
        actionHref={ROUTES.orders}
      />
    )
  }

  const title = orderTitle(order.id)
  const date = formatOrderDate(order.createdAt)

  return (
    <div className="min-h-dvh bg-surface-page pb-nav">
      <Header title={title} />

      <main className="mx-auto max-w-3xl px-3 py-4">
        <div className="rounded-card bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-black text-ink">{title}</h2>
              {date ? <p className="text-micro text-ink-faint">Feito em {date}</p> : null}
            </div>
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-micro font-bold uppercase tracking-wide text-ink-muted">
              {order.status}
            </span>
          </div>

          {order.storeName ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
              <StoreIcon className="h-4 w-4" aria-hidden="true" />
              {order.storeName}
            </p>
          ) : null}

          {order.isGift ? (
            <div className="mt-3 rounded-[16px] bg-primary/10 p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <Gift className="h-4 w-4 shrink-0" aria-hidden="true" />
                Presente para {order.giftRecipientName || 'destinatário'}
              </p>
              {order.giftMessage ? <p className="mt-1 text-ink-muted">"{order.giftMessage}"</p> : null}
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-card bg-surface p-4 shadow-card">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink-muted">Itens</h3>
          <ul aria-label="Itens do pedido" className="mt-3 grid gap-3">
            {order.itemLines?.length ? (
              order.itemLines.map((line, index) => (
                <li key={index} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold text-ink">{line.title}</p>
                    <p className="text-ink-faint">
                      {line.quantity}× {formatCurrency(line.unitPrice)}
                    </p>
                  </div>
                  <p className="tabular font-display font-bold text-ink">{formatCurrency(line.lineTotal)}</p>
                </li>
              ))
            ) : order.items?.length ? (
              order.items.map((item, index) => (
                <li key={index} className="text-sm text-ink-muted">
                  {item}
                </li>
              ))
            ) : (
              <li className="text-sm text-ink-muted">Itens não registrados neste pedido.</li>
            )}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
            <p className="font-display text-sm font-bold uppercase tracking-wide text-ink-muted">Total</p>
            <p className="tabular font-display text-lg font-black text-ink">{formatCurrency(order.value)}</p>
          </div>
        </div>

        <div className="mt-4 rounded-card bg-surface p-4 shadow-card">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink-muted">Pagamento</h3>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm text-ink-muted">{order.payment ?? 'Pix'}</p>
            {order.paymentStatus && order.paymentStatus !== 'NONE' ? (
              <PaymentStatusChip paymentStatus={order.paymentStatus} />
            ) : (
              <span className="text-micro text-ink-faint">{paymentStatusLabel(order.paymentStatus)}</span>
            )}
          </div>
          {/* "Retomar pagamento" para pedido PENDING: fica fora desta entrega —
              o fluxo de pagamento (usePaymentCheckoutState/PaymentStep) está
              acoplado ao CartDrawer que acabou de criar o pedido (customer,
              endereço de cobrança, tokenização de cartão no mesmo componente).
              Encaixar aqui sem esse contexto reconstruiria metade do checkout.
              Melhoria futura: extrair o formulário de pagamento para reuso
              autônomo por pedido. */}
        </div>
      </main>
    </div>
  )
}
