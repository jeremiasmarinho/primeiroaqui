import { Bike, CheckCircle, Map } from 'lucide-react'
import { Link } from 'wouter'
import { formatCurrency } from '../lib/format'
import { ROUTES } from '../router/routes'
import type { Order } from '../types'

interface TrackingScreenProps {
  currentOrder: Order | null
  onBack: () => void
}

/** Rastreio do pedido corrente. Sem pedido, mostra estado vazio com saida. */
export default function TrackingScreen({ currentOrder, onBack }: TrackingScreenProps) {
  if (!currentOrder) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface-page p-6">
        <div className="max-w-sm rounded-card bg-surface p-8 text-center shadow-card">
          <Map className="mx-auto h-10 w-10 text-ink-faint" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-bold text-ink">Nenhum pedido em andamento</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Assim que voce finalizar uma compra, o rastreio aparece aqui.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="btn-primary min-h-[44px] mt-4"
          >
            Voltar as ofertas
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-page p-4 md:p-8">
      <div className="mx-auto max-w-5xl rounded-[32px] bg-surface p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Pedido</p>
            <h2 className="text-2xl font-black text-ink">{currentOrder ? currentOrder.id : '1004'}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={ROUTES.orders}
              className="inline-flex min-h-[44px] items-center rounded-full border border-line px-4 text-sm font-bold text-ink-muted"
            >
              Ver todos os pedidos
            </Link>
            <button
              onClick={() => onBack()}
              className="btn-primary min-h-[44px]"
            >
              Voltar
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[24px] bg-surface-page p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Map className="h-6 w-6" /></div>
              <div>
                <p className="text-sm font-semibold text-ink-muted">Rastreamento ativo</p>
                <p className="text-lg font-black text-ink">Seu pedido está em rota</p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {[
                { title: 'Pedido confirmado', time: '14:32', done: true },
                { title: 'Coletado na loja', time: '14:50', done: true },
                { title: 'A caminho', time: '15:10', done: false },
              ].map((step) => (
                <div key={step.title} className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${step.done ? 'bg-success text-white' : 'bg-surface-sunken text-ink-muted'}`}>
                    {step.done ? <CheckCircle className="h-4 w-4" /> : <Bike className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="font-bold text-ink">{step.title}</p>
                    <p className="text-sm text-ink-muted">{step.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] bg-ink p-5 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-faint">Resumo</p>
            <p className="mt-3 text-2xl font-black">{currentOrder ? formatCurrency(currentOrder.value) : 'R$ 0,00'}</p>
            <div className="mt-4 space-y-2 text-sm text-ink-faint">
              <div className="flex justify-between"><span>Cliente</span><span>{currentOrder ? currentOrder.customer : 'Cliente'}</span></div>
              <div className="flex justify-between"><span>Agente</span><span>{currentOrder ? currentOrder.agent : 'Agente'}</span></div>
              <div className="flex justify-between"><span>Status</span><span>{currentOrder ? currentOrder.status : 'Processando'}</span></div>
              <div className="flex justify-between"><span>Pagamento</span><span>{currentOrder ? currentOrder.payment : 'Pix'}</span></div>
              {currentOrder.address ? (
                <div className="flex justify-between gap-2"><span>Entrega</span><span className="text-right">{currentOrder.address}</span></div>
              ) : null}
            </div>
            {currentOrder?.items?.length ? (
              <div className="mt-4 rounded-[20px] bg-white/10 p-3 text-sm text-white/80">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint">Itens do pedido</p>
                <p className="mt-2 leading-6">{currentOrder.items.join(', ')}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
