import AgentsTab, { type AgentForm } from './AgentsTab'
import OrdersTab from './OrdersTab'
import OverviewTab, { type Metric } from './OverviewTab'
import PerformanceTab from './PerformanceTab'
import type { Agent, Order, OrderStatus, Role, ScheduleItem } from '../../types'

export type AdminTab = 'overview' | 'agents' | 'orders' | 'performance'

const TAB_LABELS: Record<AdminTab, string> = {
  overview: 'Visão Geral',
  agents: 'Agentes',
  orders: 'Pedidos',
  performance: 'Desempenho',
}

interface AdminScreenProps {
  userRole: Role
  adminTab: AdminTab
  onTabChange: (tab: AdminTab) => void
  metrics: Metric[]
  schedule: ScheduleItem[]
  orders: Order[]
  agents: Agent[]
  agentForm: AgentForm
  onAgentFormChange: (patch: Partial<AgentForm>) => void
  onAgentSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onAgentReset: () => void
  onAgentEdit: (agent: Agent) => void
  onAgentDelete: (agentId: number) => void
  onStatusChange: (orderId: string, status: OrderStatus) => void
  onBack: () => void
}

/**
 * Painel operacional. O guard de papel fica aqui e não só na navegação: mesmo
 * que alguém force a tela, `client` não renderiza o conteúdo (regressão B5).
 */
export default function AdminScreen({
  userRole,
  adminTab,
  onTabChange,
  metrics,
  schedule,
  orders,
  agents,
  agentForm,
  onAgentFormChange,
  onAgentSubmit,
  onAgentReset,
  onAgentEdit,
  onAgentDelete,
  onStatusChange,
  onBack,
}: AdminScreenProps) {
  if (userRole !== 'admin') {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface-page p-6">
        <div className="max-w-sm rounded-card bg-surface p-8 text-center shadow-card">
          <h2 className="font-display text-lg font-bold text-ink">Acesso restrito</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Esta área é exclusiva da operação. Entre com uma conta autorizada.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="btn-primary min-h-[44px] mt-4"
          >
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
              Painel operacional
            </p>
            <h1 className="text-2xl font-black text-ink">Gestão multiagentes</h1>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="btn-primary min-h-[44px]"
          >
            Voltar ao marketplace
          </button>
        </div>

        <div role="tablist" aria-label="Seções do painel" className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(TAB_LABELS) as AdminTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={adminTab === tab}
              onClick={() => onTabChange(tab)}
              className={`min-h-[44px] rounded-full px-4 text-sm font-semibold transition-colors duration-150 ${
                adminTab === tab ? 'bg-primary text-white' : 'bg-surface-sunken text-ink-muted'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {adminTab === 'overview' && (
            <OverviewTab metrics={metrics} schedule={schedule} orders={orders} agents={agents} />
          )}
          {adminTab === 'agents' && (
            <AgentsTab
              agents={agents}
              agentForm={agentForm}
              onAgentFormChange={onAgentFormChange}
              onSubmit={onAgentSubmit}
              onReset={onAgentReset}
              onEdit={onAgentEdit}
              onDelete={onAgentDelete}
            />
          )}
          {adminTab === 'orders' && <OrdersTab orders={orders} onStatusChange={onStatusChange} />}
          {adminTab === 'performance' && <PerformanceTab agents={agents} />}
        </div>
      </div>
    </div>
  )
}
