import { useEffect, useRef, useState } from 'react'
import type { ApiAdminStore } from '../../lib/api'

interface AdminStoresTabProps {
  stores: ApiAdminStore[]
  onSetActive: (storeId: string, isActive: boolean) => void
}

const numberBR = new Intl.NumberFormat('pt-BR')
const CONFIRM_WINDOW_MS = 4000

/**
 * Lojas da plataforma com dono e volumes, e a moderação ativar/desativar.
 * Desativar pede confirmação — tira a loja do ar para os compradores.
 * Confirmação é inline (dois cliques), não window.confirm nativo, para não
 * travar automação/testes: o botão vira "Confirmar desativação?" por alguns
 * segundos antes de voltar ao estado normal se não for clicado de novo.
 */
export default function AdminStoresTab({ stores, onSetActive }: AdminStoresTabProps) {
  const [pendingStoreId, setPendingStoreId] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (stores.length === 0) {
    return (
      <div className="rounded-[24px] border border-line p-6 text-center">
        <h3 className="text-lg font-black text-ink">Nenhuma loja cadastrada</h3>
        <p className="mt-2 text-sm text-ink-muted">
          As lojas criadas pelos lojistas aparecem aqui para moderação.
        </p>
      </div>
    )
  }

  const handleToggle = (store: ApiAdminStore) => {
    if (store.isActive) {
      if (pendingStoreId !== store.id) {
        setPendingStoreId(store.id)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setPendingStoreId(null), CONFIRM_WINDOW_MS)
        return
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setPendingStoreId(null)
    }
    onSetActive(store.id, !store.isActive)
  }

  return (
    <div className="overflow-x-auto rounded-[24px] border border-line">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs font-semibold uppercase tracking-[0.15em] text-ink-muted">
            <th scope="col" className="px-4 py-3">Loja</th>
            <th scope="col" className="px-4 py-3">Dono</th>
            <th scope="col" className="px-4 py-3 text-right">Produtos</th>
            <th scope="col" className="px-4 py-3 text-right">Pedidos</th>
            <th scope="col" className="px-4 py-3">Situação</th>
            <th scope="col" className="px-4 py-3">Moderação</th>
          </tr>
        </thead>
        <tbody>
          {stores.map((store) => (
            <tr key={store.id} className="border-b border-line last:border-b-0">
              <td className="px-4 py-3 font-semibold text-ink">{store.name}</td>
              <td className="px-4 py-3 text-ink">{store.ownerName}</td>
              <td className="tabular px-4 py-3 text-right text-ink">
                {numberBR.format(store.productCount)}
              </td>
              <td className="tabular px-4 py-3 text-right text-ink">
                {numberBR.format(store.orderCount)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    store.isActive ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                  }`}
                >
                  {store.isActive ? 'Ativa' : 'Desativada'}
                </span>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => handleToggle(store)}
                  className={`min-h-[36px] rounded-[12px] px-3 py-1 text-xs font-semibold ${
                    store.isActive
                      ? pendingStoreId === store.id
                        ? 'border border-error bg-error text-white'
                        : 'border border-line text-ink-muted'
                      : 'btn-primary'
                  }`}
                >
                  {store.isActive
                    ? pendingStoreId === store.id
                      ? 'Confirmar desativação?'
                      : `Desativar ${store.name}`
                    : `Reativar ${store.name}`}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
