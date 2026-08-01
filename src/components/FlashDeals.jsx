import { ChevronRight } from 'lucide-react'
import Countdown from './Countdown.jsx'
import Price from './Price.jsx'
import { discountPercent } from '../data/catalog.js'

/**
 * Bloco de ofertas relâmpago: cabeçalho amarelo com contador e lista compacta
 * (imagem à esquerda, preço à direita) — densidade alta, feita para escaneio.
 */
export default function FlashDeals({ products, onOpen, secondsRemaining = 2379 }) {
  const deals = products
    .filter((product) => (discountPercent(product) ?? 0) >= 15)
    .slice(0, 3)

  if (deals.length === 0) return null

  return (
    <section aria-labelledby="ofertas-relampago" className="px-3 pt-4">
      <div className="overflow-hidden rounded-card bg-surface shadow-card">
        <div className="flex items-center justify-between gap-2 bg-brand px-3 py-2.5">
          <h2 id="ofertas-relampago" className="font-display text-sm font-bold uppercase tracking-wide text-ink">
            Ofertas relâmpago
          </h2>
          <Countdown initialSeconds={secondsRemaining} />
        </div>

        <ul className="divide-y divide-line">
          {deals.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => onOpen?.(product)}
                className="flex w-full items-center gap-3 p-3 text-left transition-colors
                           duration-150 hover:bg-surface-sunken"
              >
                <img
                  src={product.image}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  decoding="async"
                  className="h-16 w-16 shrink-0 rounded bg-surface-sunken object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2-fallback text-sm leading-snug text-ink">{product.title}</p>
                  <p className="mt-0.5 text-micro text-ink-faint">{product.seller}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Price product={product} size="sm" />
                </div>
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="flex min-h-[44px] w-full items-center justify-center gap-1 border-t
                     border-line text-sm font-bold text-ink transition-colors duration-150
                     hover:bg-surface-sunken"
        >
          Ver todas as ofertas
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
