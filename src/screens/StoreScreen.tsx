import { useEffect, useState } from 'react'
import { ArrowLeft, MapPin, Store as StoreIcon } from 'lucide-react'
import { Link } from 'wouter'

import EmptyState from '../components/EmptyState'
import ProductCard from '../components/ProductCard'
import { api, ApiError } from '../lib/api'
import { toViewStore } from '../lib/adapters'
import { fallbackTo } from '../lib/images'
import { ROUTES } from '../router/routes'
import type { Product, Store } from '../types'

interface StoreScreenProps {
  /** Id (uuid) da loja — a URL passou de slug para id na integração com a API. */
  storeId: string
  /** Catálogo carregado — filtrado por loja aqui (a API não lista por loja ainda). */
  allProducts: Product[]
  favorites: Product[]
  onToggleFavorite: (product: Product) => void
  onAddToCart: (product: Product) => void
}

/**
 * Página da loja sobre GET /api/stores/:id. O catálogo exibido é o filtro
 * dos produtos já carregados por `storeId` — quando a API ganhar
 * `GET /products?storeId=`, a lista passa a ser completa (pendência).
 */
export default function StoreScreen({
  storeId,
  allProducts,
  favorites,
  onToggleFavorite,
  onAddToCart,
}: StoreScreenProps) {
  const [store, setStore] = useState<Store | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError('')
    setNotFound(false)
    api
      .getStore(storeId)
      .then(({ store: dto }) => {
        if (!cancelled) setStore(toViewStore(dto))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
          return
        }
        setError(
          err instanceof ApiError && err.status > 0
            ? err.message
            : 'Não foi possível carregar a loja. Verifique sua conexão.',
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [storeId, reloadKey])

  if (notFound) {
    return (
      <EmptyState
        Icon={StoreIcon}
        title="Loja não encontrada"
        message="Esta loja pode ter saído do ar ou o link está incorreto."
        actionLabel="Voltar às ofertas"
        actionHref={ROUTES.home}
      />
    )
  }

  const header = (
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
  )

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-surface-page pb-nav">
        {header}
        <main className="mx-auto max-w-6xl px-3 pb-6">
          <div
            role="status"
            aria-busy="true"
            aria-label="Carregando loja…"
            className="mt-3 animate-pulse overflow-hidden rounded-card bg-surface shadow-card"
          >
            <div className="h-36 w-full bg-surface-sunken md:h-48" />
            <div className="p-4">
              <div className="h-6 w-1/2 rounded bg-surface-sunken" />
              <div className="mt-2 h-4 w-1/3 rounded bg-surface-sunken" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !store) {
    return (
      <div className="min-h-dvh bg-surface-page pb-nav">
        {header}
        <main className="mx-auto max-w-6xl px-3 pb-6">
          <div className="mt-3 rounded-card bg-surface p-8 text-center shadow-card">
            <p role="alert" className="text-sm font-bold text-error">
              {error || 'Não foi possível carregar a loja.'}
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="btn-primary min-h-[44px] mt-4 motion-safe:active:scale-95"
            >
              Tentar de novo
            </button>
          </div>
        </main>
      </div>
    )
  }

  const catalog = allProducts.filter((product) => product.storeId === store.id)

  return (
    <div className="min-h-dvh bg-surface-page pb-nav">
      {header}

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
            {store.neighborhood ? (
              <p className="mt-2 inline-flex items-center gap-1 text-sm text-ink-muted">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {store.neighborhood}
              </p>
            ) : null}
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
