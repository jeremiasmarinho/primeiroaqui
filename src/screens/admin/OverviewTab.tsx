import { formatCurrency } from '../../lib/format'
import type { Agent, Order, ScheduleItem } from '../../types'

export interface Metric {
  label: string
  value: string | number
  accent: string
}

interface OverviewTabProps {
  metrics: Metric[]
  schedule: ScheduleItem[]
  orders: Order[]
  agents: Agent[]
}

export default function OverviewTab({ metrics, schedule, orders, agents }: OverviewTabProps) {
  return (

          <div className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              {metrics.map((item) => (
                <div key={item.label} className={`rounded-[24px] border border-slate-200 p-4 ${item.accent}`}>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-2 text-2xl font-black">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-[24px] border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-black text-slate-900">Agenda do dia</h2>
                  <p className="text-sm text-slate-500">Pontos de atenção da operação</p>
                </div>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">{schedule.length} tarefas</span>
              </div>
              <div className="mt-4 space-y-3">
                {schedule.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-[20px] bg-slate-50 p-3">
                    <div>
                      <p className="font-bold text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-500">{item.agent}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{item.time}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{item.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[24px] border border-slate-200 p-4">
                <h2 className="font-black text-slate-900">Últimos pedidos</h2>
                <div className="mt-4 space-y-2">
                  {orders.slice(0, 3).map((order) => (
                    <div key={order.id} className="flex items-center justify-between rounded-[20px] bg-slate-50 p-3">
                      <div>
                        <p className="font-bold text-slate-900">{order.id}</p>
                        <p className="text-sm text-slate-500">{order.customer}</p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{order.status}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-200 p-4">
                <h2 className="font-black text-slate-900">Performance por agente</h2>
                <div className="mt-4 space-y-3">
                  {agents.map((agent) => (
                    <div key={agent.id}>
                      <div className="flex items-center justify-between text-sm font-semibold text-slate-700"><span>{agent.name}</span><span>{agent.commission}%</span></div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-slate-900" style={{ width: `${70 + agent.commission}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
  )
}
