import { ArrowLeft, MapPin, Star, Store as StoreIcon, Truck } from 'lucide-react'
import { Link } from 'wouter'

import EmptyState from '../components/EmptyState'
import ProductCard from '../components/ProductCard'
import { products, stores } from '../data/catalog'
import { fallbackTo } from '../lib/images'
import { ROUTES } from '../router/routes'
import type { Product } from '../types'

interface StoreScreenProps {
  slug: string
  favorites: Product[]
  onToggleFavorite: (product: Product) => void
  onAddToCart: (product: Product) => void
}

/** Página da loja: capa, reputação e catálogo filtrado por vendedor. */
export default function StoreScreen({
  slug,
  favorites,
  onToggleFavorite,
  onAddToCart,
}: StoreScreenProps) {
  const store = stores.find((item) => item.slug === slug)

  if (!store) {
    return (
      <EmptyState
        Icon={StoreIcon}
        title="Loja não encontrada"
        message="Esta loja pode ter saído do ar ou o link está incorreto."
        actionLabel="Ver todas as lojas"
        actionHref={ROUTES.home}
      />
    )
  }

  const catalog = products.filter((product) => product.seller === store.name)

  return (
    <div className="min-h-dvh bg-surface-page pb-nav">
      <header className="safe-top sticky top-0 z-30 flex items-center gap-2 bg-brand px-3 py-2">
        <Link
          href={ROUTES.home}
          aria-label="Voltar às ofertas"
          className="grid h-11 w-11 place-items-center rounded-full text-navy transition-colors duration-150 hover:bg-brand-deep"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <p className="truncate text-sm font-bold text-navy">Loja</p>
      </header>

      <main className="mx-auto max-w-6xl px-3 pb-6">
        <div className="mt-3 overflow-hidden rounded-card bg-surface shadow-card">
          <img
            src={store.cover}
            alt=""
            width={640}
            height={360}
            loading="eager"
            fetchPriority="high"
            onError={fallbackTo(store.name)}
            className="h-36 w-full bg-surface-sunken object-cover md:h-48"
          />
          <div className="p-4">
            <h1 className="font-display text-xl font-bold text-ink">{store.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {store.neighborhood}
              </span>
              <span className="inline-flex items-center gap-1">
                <Star className="h-4 w-4 fill-brand-deep text-brand-deep" aria-hidden="true" />
                <span className="tabular">{store.rating.toFixed(1)}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Truck className="h-4 w-4" aria-hidden="true" />
                <span className="tabular">{store.deliveries.toLocaleString('pt-BR')}</span> entregas
              </span>
              <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-micro font-bold uppercase tracking-wide">
                {store.category}
              </span>
            </div>
          </div>
        </div>

        <section aria-labelledby="catalogo-loja" className="mt-5">
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <h2 id="catalogo-loja" className="font-display text-base font-bold text-ink">
              Produtos desta loja
            </h2>
            <span className="text-sm font-semibold text-ink-muted">{catalog.length} itens</span>
          </div>

          {catalog.length === 0 ? (
            <p className="rounded-card bg-surface p-6 text-center text-sm text-ink-muted shadow-card">
              Esta loja ainda não tem produtos publicados.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {catalog.map((product, index) => (
                <li key={product.id}>
                  <ProductCard
                    product={product}
                    priority={index < 4}
                    isFavorite={favorites.some((item) => item.id === product.id)}
                    onToggleFavorite={onToggleFavorite}
                    onAddToCart={onAddToCart}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
