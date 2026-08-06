import { Store as StoreIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'wouter'

import EmptyState from '../../components/EmptyState'
import { formatCents } from '../../lib/money'
import { ROUTES } from '../../router/routes'
import { useStoreDashboard } from '../../state/useStoreDashboard'
import type { Role } from '../../types'
import OrdersPanel from './OrdersPanel'
import ProductsPanel from './ProductsPanel'

type DashboardTab = 'orders' | 'products'

interface StoreDashboardScreenProps {
  userRole: Role
}

/**
 * Painel do lojista (/minha-loja): visão geral dos pedidos recebidos e gestão
 * dos produtos. É ferramenta de trabalho, não vitrine — hierarquia direta,
 * sem hero. A rota já é protegida por sessão; o guard de papel fica aqui.
 */
export default function StoreDashboardScreen({ userRole }: StoreDashboardScreenProps) {
  const canOperate = userRole === 'STORE_OWNER' || userRole === 'ADMIN'
  const dashboard = useStoreDashboard(canOperate)
  const [tab, setTab] = useState<DashboardTab>('orders')

  if (!canOperate) {
    return (
      <EmptyState
        Icon={StoreIcon}
        title="Área do lojista"
        message="Esta área é para quem vende no Primeiro Aqui. Cadastre seu negócio no seu perfil."
        actionLabel="Ir para o perfil"
        actionHref={ROUTES.profile}
      />
    )
  }

  if (dashboard.isLoading) {
    return (
      <div role="status" className="grid min-h-dvh place-items-center bg-surface-page p-6">
        <p className="text-sm font-semibold text-ink-muted">Carregando sua loja…</p>
      </div>
    )
  }

  if (dashboard.loadError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface-page p-6">
        <div className="rounded-[24px] bg-surface p-6 text-center shadow-lg">
          <p className="font-semibold text-ink">{dashboard.loadError}</p>
          <button onClick={dashboard.retry} className="btn-primary mt-4 min-h-[44px] rounded-[16px] px-4 py-2 text-sm font-semibold">
            Tentar de novo
          </button>
        </div>
      </div>
    )
  }

  if (!dashboard.store) {
    return (
      <EmptyState
        Icon={StoreIcon}
        title="Você ainda não tem loja"
        message="Complete o cadastro do seu negócio no perfil para começar a vender."
        actionLabel="Ir para o perfil"
        actionHref={ROUTES.profile}
      />
    )
  }

  const { metrics } = dashboard

  return (
    <div className="min-h-screen bg-surface-page p-4 md:p-8">
      <div className="mx-auto max-w-4xl rounded-[32px] bg-surface p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Minha loja</p>
            <h1 className="text-2xl font-black text-ink">{dashboard.store.name}</h1>
          </div>
          <Link href={ROUTES.profile} className="min-h-[44px] rounded-[16px] border border-line px-4 py-2 text-sm font-semibold text-ink-muted">
            Voltar ao perfil
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[20px] bg-surface-page p-4">
            <p className="text-sm text-ink-muted">Pedidos hoje</p>
            <p className="text-2xl font-black text-ink">{metrics.ordersToday}</p>
          </div>
          <div className="rounded-[20px] bg-surface-page p-4">
            <p className="text-sm text-ink-muted">Aguardando confirmação</p>
            <p className="text-2xl font-black text-ink">{metrics.pending}</p>
          </div>
          <div className="rounded-[20px] bg-surface-page p-4">
            <p className="text-sm text-ink-muted">Faturamento</p>
            <p className="text-2xl font-black text-ink">{formatCents(metrics.revenueCents)}</p>
          </div>
        </div>

        {dashboard.actionError ? (
          <p role="alert" className="mt-4 rounded-[16px] bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {dashboard.actionError}
          </p>
        ) : null}

        <div role="tablist" aria-label="Seções do painel" className="mt-6 flex gap-2 border-b border-line pb-2">
          <button
            role="tab"
            aria-selected={tab === 'orders'}
            onClick={() => setTab('orders')}
            className={`min-h-[44px] rounded-[16px] px-4 py-2 text-sm font-semibold ${tab === 'orders' ? 'btn-primary' : 'text-ink-muted'}`}
          >
            Pedidos
          </button>
          <button
            role="tab"
            aria-selected={tab === 'products'}
            onClick={() => setTab('products')}
            className={`min-h-[44px] rounded-[16px] px-4 py-2 text-sm font-semibold ${tab === 'products' ? 'btn-primary' : 'text-ink-muted'}`}
          >
            Meus produtos
          </button>
        </div>

        <div className="mt-4">
          {tab === 'orders' ? (
            <OrdersPanel orders={dashboard.orders} onChangeStatus={(id, status) => void dashboard.changeOrderStatus(id, status)} />
          ) : (
            <ProductsPanel
              products={dashboard.products}
              onCreate={dashboard.createProduct}
              onUpdate={dashboard.updateProduct}
              onUploadPhoto={dashboard.uploadPhoto}
            />
          )}
        </div>
      </div>
    </div>
  )
}
