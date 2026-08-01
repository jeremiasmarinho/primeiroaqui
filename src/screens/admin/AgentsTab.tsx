import { Edit, Trash2 } from 'lucide-react'
import type { Agent, AgentStatus } from '../../types'

export interface AgentForm {
  id: number | ''
  name: string
  region: string
  specialty: string
  status: AgentStatus
  commission: number | ''
}

interface AgentsTabProps {
  agents: Agent[]
  agentForm: AgentForm
  onAgentFormChange: (patch: Partial<AgentForm>) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onReset: () => void
  onEdit: (agent: Agent) => void
  onDelete: (agentId: number) => void
}

export default function AgentsTab({
  agents,
  agentForm,
  onAgentFormChange,
  onSubmit,
  onReset,
  onEdit,
  onDelete,
}: AgentsTabProps) {
  return (

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={onSubmit} className="rounded-[24px] border border-slate-200 p-4">
              <h2 className="font-black text-slate-900">{agentForm.id ? 'Editar agente' : 'Novo agente'}</h2>
              <div className="mt-4 space-y-3">
                <input value={agentForm.name} onChange={(event) => onAgentFormChange({ name: event.target.value })} placeholder="Nome" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />
                <input value={agentForm.region} onChange={(event) => onAgentFormChange({ region: event.target.value })} placeholder="Região" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />
                <input value={agentForm.specialty} onChange={(event) => onAgentFormChange({ specialty: event.target.value })} placeholder="Especialidade" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />
                <select value={agentForm.status} onChange={(event) => onAgentFormChange({ status: event.target.value as AgentStatus })} className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none">
                  <option value="Disponível">Disponível</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Offline">Offline</option>
                </select>
                <input type="number" value={agentForm.commission} onChange={(event) => onAgentFormChange({ commission: event.target.value === '' ? '' : Number(event.target.value) })} placeholder="Comissão (%)" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />
              </div>
              <div className="mt-4 flex gap-2">
                <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">Salvar</button>
                <button type="button" onClick={onReset} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Limpar</button>
              </div>
            </form>

            <div className="space-y-3">
              {agents.map((agent) => (
                <div key={agent.id} className="flex flex-wrap items-center justify-between rounded-[24px] border border-slate-200 p-4">
                  <div>
                    <p className="font-black text-slate-900">{agent.name}</p>
                    <p className="text-sm text-slate-500">{agent.specialty} • {agent.region}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{agent.status}</span>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">{agent.commission}%</span>
                    <button onClick={() => onEdit(agent)} className="rounded-full bg-slate-100 p-2"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => onDelete(agent.id)} className="rounded-full bg-red-50 p-2 text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
  )
}
