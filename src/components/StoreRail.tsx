import { useEffect, useState } from 'react'
import { Link } from 'wouter'

import { api, type ApiPublicStore } from '../lib/api'
import { storeCategoryIcon, storeCategoryLabel } from '../lib/storeCategory'
import { ROUTES } from '../router/routes'

/**
 * Trilho "Lojas da cidade" sobre GET /api/stores (listagem pública). Falha
 * de rede não quebra a home: o rail simplesmente não renderiza nesse caso.
 */
export default function StoreRail() {
  const [stores, setStores] = useState<ApiPublicStore[] | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .listStores()
      .then(({ stores: fetched }) => {
        if (!cancelled) setStores(fetched)
      })
      .catch(() => {
        if (!cancelled) setStores([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (stores === null) {
    return (
      <section aria-labelledby="lojas-da-cidade" className="pt-4">
        <div className="flex items-center justify-between gap-2 px-3 pb-2">
          <h2 id="lojas-da-cidade" className="font-display text-base font-bold text-ink">
            Lojas da cidade
          </h2>
        </div>
        <ul aria-hidden="true" className="rail no-scrollbar px-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <li key={index} className="w-40 shrink-0">
              <div className="animate-pulse rounded-card bg-surface p-3 shadow-card">
                <div className="h-4 w-3/4 rounded bg-surface-sunken" />
                <div className="mt-2 h-3 w-1/2 rounded bg-surface-sunken" />
              </div>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (stores.length === 0) return null

  return (
    <section aria-labelledby="lojas-da-cidade" className="pt-4">
      <div className="flex items-center justify-between gap-2 px-3 pb-2">
        <h2 id="lojas-da-cidade" className="font-display text-base font-bold text-ink">
          Lojas da cidade
        </h2>
        <span className="text-sm font-semibold text-ink-muted">{stores.length} lojas</span>
      </div>

      <ul className="rail no-scrollbar px-3">
        {stores.map((store) => {
          const CategoryIcon = storeCategoryIcon(store.category)
          return (
            <li key={store.id} className="w-40 shrink-0">
              <Link
                href={ROUTES.store(store.id)}
                aria-label={`Ver loja ${store.name}`}
                className="block h-full overflow-hidden rounded-card bg-surface p-3 text-left shadow-card
                           transition-shadow duration-200 hover:shadow-raised"
              >
                <p className="truncate font-display font-bold text-ink">{store.name}</p>
                <p className="mt-1 flex items-center gap-1 text-micro text-ink-muted">
                  <CategoryIcon className="h-3 w-3" aria-hidden="true" />
                  {storeCategoryLabel(store.category)}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
