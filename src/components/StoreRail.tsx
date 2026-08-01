import { MapPin, Star } from 'lucide-react'
import { stores } from '../data/catalog'
import { fallbackTo } from '../lib/images'
import type { Store } from '../types'

interface StoreRailProps {
  onSelect?: (store: Store) => void
}

/**
 * Trilho de lojas do bairro. Enquanto não houver rota de loja (WU-44/46), o
 * clique filtra o catálogo pela categoria da loja — comportamento real, não
 * botão decorativo.
 */
export default function StoreRail({ onSelect }: StoreRailProps) {
  return (
    <section aria-labelledby="lojas-do-bairro" className="pt-4">
      <div className="flex items-center justify-between gap-2 px-3 pb-2">
        <h2 id="lojas-do-bairro" className="font-display text-base font-bold text-ink">
          Lojas do bairro
        </h2>
        <span className="text-sm font-semibold text-ink-muted">{stores.length} lojas</span>
      </div>

      <ul className="rail no-scrollbar px-3">
        {stores.map((store) => (
          <li key={store.id} className="w-[15rem]">
            <button
              type="button"
              onClick={() => onSelect?.(store)}
              aria-label={`Ver produtos de ${store.name}, ${store.neighborhood}`}
              className="w-full overflow-hidden rounded-card bg-surface text-left shadow-card
                         transition-shadow duration-200 hover:shadow-raised"
            >
              <img
                src={store.cover}
                alt=""
                width={640}
                height={360}
                loading="lazy"
                decoding="async"
                onError={fallbackTo(store.name)}
                className="h-24 w-full bg-surface-sunken object-cover"
              />
              <div className="p-3">
                <p className="truncate font-display font-bold text-ink">{store.name}</p>
                <p className="mt-1 flex items-center gap-1 text-micro text-ink-muted">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {store.neighborhood}
                </p>
                <p className="mt-1 flex items-center gap-1 text-micro text-ink-muted">
                  <Star className="h-3 w-3 fill-brand-deep text-brand-deep" aria-hidden="true" />
                  <span className="tabular">{store.rating.toFixed(1)}</span>
                  <span className="text-ink-faint">
                    · {store.deliveries.toLocaleString('pt-BR')} entregas
                  </span>
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
