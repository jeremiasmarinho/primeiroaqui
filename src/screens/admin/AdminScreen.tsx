import { useAdminDashboard } from '../../state/useAdminDashboard'
import type { Role } from '../../types'
import AdminOrdersTab from './AdminOrdersTab'
import AdminOverviewTab from './AdminOverviewTab'
import AdminStoresTab from './AdminStoresTab'

export type AdminTab = 'overview' | 'orders' | 'stores'

const TAB_LABELS: Record<AdminTab, string> = {
  overview: 'Visão geral',
  orders: 'Pedidos',
  stores: 'Lojas',
}

interface AdminScreenProps {
  userRole: Role
  adminTab: AdminTab
  onTabChange: (tab: AdminTab) => void
  onBack: () => void
}

/**
 * Dashboard da plataforma para o papel ADMIN, sobre dados reais da API
 * (/api/admin/*). O guard de papel fica aqui e não só na navegação: mesmo que
 * alguém force a tela, quem não é ADMIN não renderiza o conteúdo — e o papel
 * vem sempre do GET /api/me (regressão B5), nunca do client.
 */
export default function AdminScreen({ userRole, adminTab, onTabChange, onBack }: AdminScreenProps) {
  const isAdmin = userRole === 'ADMIN'
  const dashboard = useAdminDashboard(isAdmin)
  // /admin/aba-que-nao-existe cai na visão geral em vez de tela em branco.
  const tab: AdminTab = adminTab in TAB_LABELS ? adminTab : 'overview'

  if (!isAdmin) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface-page p-6">
        <div className="max-w-sm rounded-card bg-surface p-8 text-center shadow-card">
          <h2 className="font-display text-lg font-bold text-ink">Acesso restrito</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Esta área é exclusiva da administração da plataforma. Entre com uma conta autorizada.
          </p>
          <button type="button" onClick={onBack} className="btn-primary min-h-[44px] mt-4">
            Voltar ao marketplace
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-surface-page p-4 md:p-6">
      <div className="mx-auto max-w-7xl rounded-[32px] bg-surface p-4 shadow-lg md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-ink-muted">
              Administração
            </p>
            <h1 className="text-2xl font-black text-ink">Painel da plataforma</h1>
          </div>
          <button type="button" onClick={onBack} className="btn-primary min-h-[44px]">
            Voltar ao marketplace
          </button>
        </div>

        <div role="tablist" aria-label="Seções do painel" className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(TAB_LABELS) as AdminTab[]).map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="tab"
              aria-selected={tab === candidate}
              onClick={() => onTabChange(candidate)}
              className={`min-h-[44px] rounded-full px-4 text-sm font-semibold transition-colors duration-150 ${
                tab === candidate ? 'bg-primary text-white' : 'bg-surface-sunken text-ink-muted'
              }`}
            >
              {TAB_LABELS[candidate]}
            </button>
          ))}
        </div>

        {dashboard.actionError ? (
          <p role="alert" className="mt-4 rounded-[16px] bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {dashboard.actionError}
          </p>
        ) : null}

        <div className="mt-6">
          {dashboard.isLoading ? (
            <div role="status" className="grid min-h-40 place-items-center">
              <p className="text-sm font-semibold text-ink-muted">Carregando o painel…</p>
            </div>
          ) : dashboard.loadError ? (
            <div className="rounded-[24px] border border-line p-6 text-center">
              <p className="font-semibold text-ink">{dashboard.loadError}</p>
              <button
                onClick={dashboard.retry}
                className="btn-primary mt-4 min-h-[44px] rounded-[16px] px-4 py-2 text-sm font-semibold"
              >
                Tentar de novo
              </button>
            </div>
          ) : (
            <>
              {tab === 'overview' && dashboard.metrics ? (
                <AdminOverviewTab metrics={dashboard.metrics} />
              ) : null}
              {tab === 'orders' ? (
                <AdminOrdersTab
                  orders={dashboard.orders}
                  hasMore={dashboard.hasMoreOrders}
                  isLoadingMore={dashboard.isLoadingMore}
                  onLoadMore={() => void dashboard.loadMoreOrders()}
                  onChangeStatus={(id, status) => void dashboard.changeOrderStatus(id, status)}
                />
              ) : null}
              {tab === 'stores' ? (
                <AdminStoresTab stores={dashboard.stores} onSetActive={(id, active) => void dashboard.setStoreActive(id, active)} />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
