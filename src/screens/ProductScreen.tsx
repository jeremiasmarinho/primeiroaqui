import { useEffect, useState } from 'react'
import { ArrowLeft, Heart, PackageSearch, Store as StoreIcon, Truck } from 'lucide-react'
import { Link } from 'wouter'

import EmptyState from '../components/EmptyState'
import Price from '../components/Price'
import ProductCard from '../components/ProductCard'
import { api, ApiError } from '../lib/api'
import { toViewProduct, toViewStore } from '../lib/adapters'
import { fallbackTo } from '../lib/images'
import { ROUTES } from '../router/routes'
import type { Product, Store } from '../types'

interface ProductScreenProps {
  productId: string
  /** Catálogo já carregado — alimenta os relacionados sem nova requisição. */
  allProducts: Product[]
  favorites: Product[]
  onToggleFavorite: (product: Product) => void
  onAddToCart: (product: Product) => void
  onBuyNow: (product: Product) => void
}

/**
 * Detalhe do produto com URL própria (ver ADR 0002), agora sobre a API real:
 * GET /api/products/:id + GET /api/stores/:id para o nome da loja. Buscar o
 * produto direto (em vez de procurar na lista da vitrine) garante que um
 * deep link funciona mesmo para produto fora da primeira página do catálogo.
 */
export default function ProductScreen({
  productId,
  allProducts,
  favorites,
  onToggleFavorite,
  onAddToCart,
  onBuyNow,
}: ProductScreenProps) {
  const [product, setProduct] = useState<Product | null>(null)
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
      .getProduct(productId)
      .then(async ({ product: dto }) => {
        // A loja dá nome ao vendedor; se a chamada falhar o produto ainda
        // aparece, só sem o link da loja.
        const storeDto = await api.getStore(dto.storeId).catch(() => null)
        if (cancelled) return
        setStore(storeDto ? toViewStore(storeDto.store) : null)
        setProduct(toViewProduct(dto, storeDto?.store.name))
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
            : 'Não foi possível carregar o produto. Verifique sua conexão.',
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId, reloadKey])

  if (notFound) {
    return (
      <EmptyState
        Icon={PackageSearch}
        title="Produto não encontrado"
        message="Este produto pode ter saído do ar ou o link está incorreto."
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
      <p className="truncate text-sm font-bold text-navy">{product?.category ?? 'Produto'}</p>
    </header>
  )

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-surface-page pb-nav">
        {header}
        <main className="mx-auto max-w-4xl px-3 pb-6">
          <div
            role="status"
            aria-busy="true"
            aria-label="Carregando produto…"
            className="mt-3 animate-pulse overflow-hidden rounded-card bg-surface shadow-card"
          >
            <div className="aspect-square w-full bg-surface-sunken" />
            <div className="p-4">
              <div className="h-6 w-3/4 rounded bg-surface-sunken" />
              <div className="mt-3 h-4 w-1/2 rounded bg-surface-sunken" />
              <div className="mt-3 h-8 w-1/3 rounded bg-surface-sunken" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-dvh bg-surface-page pb-nav">
        {header}
        <main className="mx-auto max-w-4xl px-3 pb-6">
          <div className="mt-3 rounded-card bg-surface p-8 text-center shadow-card">
            <p role="alert" className="text-sm font-bold text-error">
              {error || 'Não foi possível carregar o produto.'}
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

  const isFavorite = favorites.some((item) => item.id === product.id)
  const outOfStock = (product.stock ?? 1) <= 0
  const related = allProducts
    .filter((item) => item.category === product.category && item.id !== product.id)
    .slice(0, 4)

  return (
    <div className="min-h-dvh bg-surface-page pb-nav">
      {header}

      <main className="mx-auto max-w-4xl px-3 pb-6">
        <div className="mt-3 overflow-hidden rounded-card bg-surface shadow-card">
          {/* max-w-sm trava o tamanho em telas largas — sem teto o placeholder
              quadrado (sem foto real ainda) vira um quadrado gigante em desktop
              e empurra preço/CTA para fora da primeira dobra. */}
          <div className="mx-auto max-w-sm">
            <img
              src={product.image}
              alt={product.title}
              width={400}
              height={400}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onError={fallbackTo(product.title)}
              className="aspect-square w-full bg-surface-sunken object-cover"
            />
          </div>

          <div className="p-4">
            <h1 className="font-display text-xl font-bold leading-snug text-ink">{product.title}</h1>

            {store ? (
              <Link
                href={ROUTES.store(store.id)}
                className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-ink-muted underline-offset-2 hover:underline"
              >
                <StoreIcon className="h-4 w-4" aria-hidden="true" />
                {store.name}
                {store.neighborhood ? (
                  <span className="text-ink-faint">· {store.neighborhood}</span>
                ) : null}
              </Link>
            ) : null}

            <div className="mt-3">
              <Price product={product} size="lg" />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                <Truck className="h-4 w-4" aria-hidden="true" />
                {product.arrival}
              </span>
              {outOfStock ? (
                <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700">
                  Sem estoque
                </span>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onBuyNow(product)}
                disabled={outOfStock}
                className="btn-primary min-h-[48px] flex-1 motion-safe:active:scale-[0.98] disabled:opacity-50"
              >
                Comprar agora
              </button>
              <button
                type="button"
                onClick={() => onAddToCart(product)}
                disabled={outOfStock}
                className="min-h-[48px] flex-1 rounded-full border border-primary bg-surface px-5 text-sm font-bold text-primary-active transition-colors duration-150 hover:bg-primary/10 disabled:opacity-50"
              >
                Adicionar ao carrinho
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(product)}
                aria-pressed={isFavorite}
                aria-label={
                  isFavorite
                    ? `Remover ${product.title} dos favoritos`
                    : `Salvar ${product.title} nos favoritos`
                }
                className="grid h-12 w-12 place-items-center rounded-full border border-line bg-surface text-ink-muted"
              >
                <Heart
                  className={`h-5 w-5 ${isFavorite ? 'fill-promo text-promo' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="relacionados" className="mt-5">
            <h2 id="relacionados" className="px-1 pb-2 font-display text-base font-bold text-ink">
              Quem viu este, viu também
            </h2>
            <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {related.map((item) => (
                <li key={item.id}>
                  <ProductCard
                    product={item}
                    isFavorite={favorites.some((favorite) => favorite.id === item.id)}
                    onToggleFavorite={onToggleFavorite}
                    onAddToCart={onAddToCart}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
