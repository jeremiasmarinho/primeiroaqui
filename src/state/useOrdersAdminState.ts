import { useMemo, useState } from 'react'

import type { AgentForm } from '../screens/admin/AgentsTab'
import type { Metric } from '../screens/admin/OverviewTab'
import { formatCurrency } from '../lib/format'
import { readStoredJSON } from '../lib/storage'
import { changeOrderStatus } from './orders'
import { STORAGE_KEYS } from './session'
import {
  EMPTY_AGENT_FORM,
  EMPTY_BUSINESS,
  initialAgents,
  initialOrders,
  initialSchedule,
} from './marketplaceSeed'
import type { Agent, BusinessProfile, Notification, Order, OrderStatus, ScheduleItem } from '../types'

type AddNotification = (title: string, message: string, type?: Notification['type']) => void

/** Agentes, pedidos, painel admin e cadastro de negócio. */
export function useOrdersAdminState(addNotification: AddNotification) {
  const [agents, setAgents] = useState<Agent[]>(() => readStoredJSON(STORAGE_KEYS.agents, initialAgents))
  const [orders, setOrders] = useState<Order[]>(() => readStoredJSON(STORAGE_KEYS.orders, initialOrders))
  const [agentForm, setAgentForm] = useState<AgentForm>(EMPTY_AGENT_FORM)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(() =>
    readStoredJSON<Order | null>(STORAGE_KEYS.currentOrder, null),
  )
  const [schedule] = useState<ScheduleItem[]>(() => readStoredJSON(STORAGE_KEYS.schedule, initialSchedule))
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(() =>
    readStoredJSON<BusinessProfile | null>(STORAGE_KEYS.business, null),
  )
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [setupForm, setSetupForm] = useState<BusinessProfile>(() => businessProfile ?? EMPTY_BUSINESS)

  const metrics: Metric[] = useMemo(() => {
    const delivered = orders.filter((order) => order.status === 'Entregue').length
    const revenue = orders.reduce((sum, order) => sum + order.value, 0)
    return [
      { label: 'Pedidos', value: orders.length, accent: 'bg-blue-50 text-blue-700' },
      { label: 'Agentes', value: agents.length, accent: 'bg-amber-50 text-amber-700' },
      { label: 'Entregues', value: delivered, accent: 'bg-green-50 text-green-700' },
      { label: 'Receita', value: formatCurrency(revenue), accent: 'bg-violet-50 text-violet-700' },
    ]
  }, [agents, orders])

  const handleStatusChange = (orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order
        try {
          return changeOrderStatus(order, status)
        } catch {
          // Transição inválida é ignorada: o select não deve corromper o pedido.
          return order
        }
      }),
    )
  }

  const handleAgentSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const commission = Number(agentForm.commission)
    if (!agentForm.name || !agentForm.region || !agentForm.specialty) return
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) return

    if (agentForm.id !== '') {
      const id = Number(agentForm.id)
      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === id
            ? {
                ...agent,
                name: agentForm.name,
                region: agentForm.region,
                specialty: agentForm.specialty,
                status: agentForm.status,
                commission,
              }
            : agent,
        ),
      )
    } else {
      setAgents((prev) => [
        {
          id: prev.reduce((max, agent) => Math.max(max, agent.id), 0) + 1,
          name: agentForm.name,
          region: agentForm.region,
          specialty: agentForm.specialty,
          status: agentForm.status,
          commission,
        },
        ...prev,
      ])
    }
    setAgentForm(EMPTY_AGENT_FORM)
  }

  const handleBusinessSetupSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!setupForm.name || !setupForm.address || !setupForm.phone) return

    setBusinessProfile(setupForm)
    setIsSetupOpen(false)
    addNotification(
      'Cadastro do negocio concluido',
      `${setupForm.name} ja esta disponivel para operacao.`,
      'success',
    )
  }

  return {
    agents,
    setAgents,
    orders,
    setOrders,
    agentForm,
    currentOrder,
    setCurrentOrder,
    schedule,
    businessProfile,
    setBusinessProfile,
    isSetupOpen,
    setupForm,
    setSetupForm,
    metrics,
    onAgentFormChange: (patch: Partial<AgentForm>) => setAgentForm((prev) => ({ ...prev, ...patch })),
    onAgentSubmit: handleAgentSubmit,
    onAgentReset: () => setAgentForm(EMPTY_AGENT_FORM),
    onAgentEdit: (agent: Agent) => setAgentForm({ ...agent }),
    onAgentDelete: (agentId: number) => setAgents((prev) => prev.filter((agent) => agent.id !== agentId)),
    onStatusChange: handleStatusChange,
    onSetupFormChange: (patch: Partial<BusinessProfile>) => setSetupForm((prev) => ({ ...prev, ...patch })),
    onBusinessSetupSubmit: handleBusinessSetupSubmit,
    onSetupClose: () => setIsSetupOpen(false),
  }
}
