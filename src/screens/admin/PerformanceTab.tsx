import type { Agent } from '../../types'

interface PerformanceTabProps {
  agents: Agent[]
}

export default function PerformanceTab({ agents }: PerformanceTabProps) {
  return (

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-[24px] border border-line p-4">
              <h2 className="font-black text-ink">Taxa de entrega</h2>
              <div className="mt-4 rounded-[20px] bg-surface-page p-4">
                <div className="flex items-end gap-3">
                  {[60, 85, 72, 95].map((value, index) => (
                    <div key={index} className="flex-1">
                      <div className="rounded-t-[16px] bg-primary" style={{ height: `${value}px` }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-[24px] border border-line p-4">
              <h2 className="font-black text-ink">Ranking</h2>
              <div className="mt-4 space-y-3">
                {agents.slice().sort((a, b) => b.commission - a.commission).map((agent, index) => (
                  <div key={agent.id} className="flex items-center justify-between rounded-[20px] bg-surface-page p-3">
                    <div>
                      <p className="font-bold text-ink">{index + 1}. {agent.name}</p>
                      <p className="text-sm text-ink-muted">{agent.region}</p>
                    </div>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">{agent.commission}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
  )
}
