import { ArrowLeft, Heart, PackageSearch, Store as StoreIcon, Truck, Zap } from 'lucide-react'
import { Link } from 'wouter'

import EmptyState from '../components/EmptyState'
import Price from '../components/Price'
import ProductCard from '../components/ProductCard'
import ProductReviews from '../components/ProductReviews'
import { discountPercent, products, storeBySeller } from '../data/catalog'
import { fallbackTo } from '../lib/images'
import { ROUTES } from '../router/routes'
import type { Product } from '../types'

interface ProductScreenProps {
  productId: number
  favorites: Product[]
  onToggleFavorite: (product: Product) => void
  onAddToCart: (product: Product) => void
  onBuyNow: (product: Product) => void
}

/**
 * Detalhe do produto como tela com URL própria — antes era modal sem endereço,
 * o que impedia compartilhar uma oferta por link (ver ADR 0002).
 */
export default function ProductScreen({
  productId,
  favorites,
  onToggleFavorite,
  onAddToCart,
  onBuyNow,
}: ProductScreenProps) {
  const product = products.find((item) => item.id === productId)

  if (!product) {
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

  const store = storeBySeller(product.seller)
  const off = discountPercent(product)
  const isFavorite = favorites.some((item) => item.id === product.id)
  const related = products
    .filter((item) => item.category === product.category && item.id !== product.id)
    .slice(0, 4)

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
        <p className="truncate text-sm font-bold text-navy">{product.category}</p>
      </header>

      <main className="mx-auto max-w-4xl px-3 pb-6">
        <div className="mt-3 overflow-hidden rounded-card bg-surface shadow-card">
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

          <div className="p-4">
            <h1 className="font-display text-xl font-bold leading-snug text-ink">{product.title}</h1>

            {store ? (
              <Link
                href={ROUTES.store(store.slug)}
                className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-ink-muted underline-offset-2 hover:underline"
              >
                <StoreIcon className="h-4 w-4" aria-hidden="true" />
                {store.name}
                <span className="text-ink-faint">· {store.neighborhood}</span>
              </Link>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">{product.seller}</p>
            )}

            <div className="mt-3">
              <Price product={product} size="lg" />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {off !== null && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
                  {off}% OFF
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                <Truck className="h-4 w-4" aria-hidden="true" />
                {product.arrival}
              </span>
              {product.express && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
                  <Zap className="h-4 w-4 fill-current" aria-hidden="true" />
                  Turbo
                </span>
              )}
            </div>

            <p className="mt-4 text-sm leading-6 text-ink-muted">
              Produto vendido por {product.seller}, com entrega acompanhada por agente local e
              pagamento processado dentro do app.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onBuyNow(product)}
                className="btn-primary min-h-[48px] flex-1 motion-safe:active:scale-[0.98]"
              >
                Comprar agora
              </button>
              <button
                type="button"
                onClick={() => onAddToCart(product)}
                className="min-h-[48px] flex-1 rounded-full border border-primary bg-surface px-5 text-sm font-bold text-primary transition-colors duration-150 hover:bg-primary/10"
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

            <ProductReviews productId={product.id} />
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
