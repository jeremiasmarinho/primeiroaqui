import type { ApiAdminStore } from '../../lib/api'

interface AdminStoresTabProps {
  stores: ApiAdminStore[]
  onSetActive: (storeId: string, isActive: boolean) => void
}

const numberBR = new Intl.NumberFormat('pt-BR')

/**
 * Lojas da plataforma com dono e volumes, e a moderação ativar/desativar.
 * Desativar pede confirmação — tira a loja do ar para os compradores.
 */
export default function AdminStoresTab({ stores, onSetActive }: AdminStoresTabProps) {
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
      const confirmed = window.confirm(
        `Desativar a loja "${store.name}"? Ela sai do ar para os compradores até ser reativada.`,
      )
      if (!confirmed) return
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
              <td className="px-4 py-3 text-right text-ink [font-variant-numeric:tabular-nums]">
                {numberBR.format(store.productCount)}
              </td>
              <td className="px-4 py-3 text-right text-ink [font-variant-numeric:tabular-nums]">
                {numberBR.format(store.orderCount)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    store.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
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
                      ? 'border border-line text-ink-muted'
                      : 'btn-primary'
                  }`}
                >
                  {store.isActive ? `Desativar ${store.name}` : `Reativar ${store.name}`}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
