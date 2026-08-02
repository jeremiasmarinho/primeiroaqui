import { formatCurrency } from '../../lib/format'
import type { Order, OrderStatus } from '../../types'

interface OrdersTabProps {
  orders: Order[]
  onStatusChange: (orderId: string, status: OrderStatus) => void
}

export default function OrdersTab({ orders, onStatusChange }: OrdersTabProps) {
  return (

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-ink-muted">
                  <th className="px-3 py-3">Pedido</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Agente</th>
                  <th className="px-3 py-3">Valor</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-line">
                    <td className="px-3 py-3 font-semibold text-ink">{order.id}</td>
                    <td className="px-3 py-3 text-ink-muted">{order.customer}</td>
                    <td className="px-3 py-3 text-ink-muted">{order.agent}</td>
                    <td className="px-3 py-3 text-ink-muted">{formatCurrency(order.value)}</td>
                    <td className="px-3 py-3">
                      <select value={order.status} onChange={(event) => onStatusChange(order.id, event.target.value as OrderStatus)} className="rounded-full border border-line px-3 py-2 text-sm"> 
                        <option value="Processando">Processando</option>
                        <option value="Em rota">Em rota</option>
                        <option value="Entregue">Entregue</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
  )
}
