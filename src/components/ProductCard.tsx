import { Heart, ShoppingCart, Star, Zap } from 'lucide-react'
import { Link } from 'wouter'
import { ROUTES } from '../router/routes'
import Price from './Price'
import { soldLabel } from '../data/catalog'
import { fallbackTo } from '../lib/images'
import type { Product } from '../types'

/**
 * Card de produto. Variante `tall` para o grid principal e `wide` para trilhos
 * horizontais.
 *
 * O card inteiro é um <article> com o título como link/botão real — evita o
 * antipadrão de <div onClick> que não é alcançável por teclado. Os botões de
 * favoritar e comprar são irmãos, não filhos, para não aninhar controles.
 */
interface ProductCardProps {
  product: Product
  variant?: 'tall' | 'wide'
  isFavorite?: boolean
  onToggleFavorite?: (product: Product) => void
  onAddToCart?: (product: Product) => void
  priority?: boolean
}

export default function ProductCard({
  product,
  variant = 'tall',
  isFavorite = false,
  onToggleFavorite,
  onAddToCart,
  priority = false,
}: ProductCardProps) {
  const sold = soldLabel(product.sold)

  return (
    <article
      className={`group relative flex overflow-hidden rounded-card bg-surface shadow-card
                  transition-shadow duration-200 hover:shadow-raised
                  ${variant === 'wide' ? 'w-[42vw] max-w-[190px] flex-col' : 'flex-col'}`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-surface-sunken">
        <img
          src={product.image}
          alt={product.title}
          width={400}
          height={400}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onError={fallbackTo(product.title)}
          className="h-full w-full object-cover transition-transform duration-300
                     motion-safe:group-hover:scale-[1.03]"
        />

        <button
          type="button"
          onClick={() => onToggleFavorite?.(product)}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Remover ${product.title} dos favoritos` : `Salvar ${product.title} nos favoritos`}
          className="absolute right-1.5 top-1.5 z-10 grid h-11 w-11 place-items-center rounded-full
                     bg-surface/85 text-ink-muted backdrop-blur-sm transition-colors duration-150
                     hover:text-promo focus-visible:text-promo"
        >
          <Heart className={`h-5 w-5 ${isFavorite ? 'fill-promo text-promo' : ''}`} aria-hidden="true" />
        </button>

        {product.bestSeller && (
          <span className="absolute bottom-0 left-0 bg-brand px-2 py-1 text-micro font-extrabold uppercase tracking-wide text-navy">
            Mais vendido
          </span>
        )}

        {/* Compra em um toque, sem abrir o detalhe — padrão de app de marketplace. */}
        <button
          type="button"
          onClick={() => onAddToCart?.(product)}
          aria-label={`Adicionar ${product.title} ao carrinho`}
          className="absolute bottom-1.5 right-1.5 z-10 grid h-11 w-11 place-items-center rounded-full
                     bg-surface text-ink shadow-raised transition-transform duration-150
                     motion-safe:active:scale-90"
        >
          <ShoppingCart className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {/* Link real, nao <div onClick>: alcancavel por teclado, abre em nova
            aba com ctrl+clique e da endereco proprio ao produto. */}
        <h3 className="line-clamp-2-fallback text-sm leading-snug text-ink">
          <Link
            href={ROUTES.product(product.id)}
            className="text-left after:absolute after:inset-0 after:content-['']"
          >
            {product.title}
          </Link>
        </h3>

        <Price product={product} size={variant === 'wide' ? 'sm' : 'md'} />

        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
          <span className="flex items-center gap-0.5 text-micro text-ink-muted">
            <Star className="h-3 w-3 fill-brand-deep text-brand-deep" aria-hidden="true" />
            <span className="tabular">{product.rating.toFixed(1)}</span>
            <span className="sr-only">de 5, {product.reviews} avaliações</span>
          </span>
          {sold && <span className="text-micro text-ink-faint">{sold}</span>}
        </div>

        <p className="text-micro font-bold text-ship">{product.arrival}</p>

        {product.express && (
          <p className="flex items-center gap-1 text-micro font-extrabold uppercase tracking-wide text-ship">
            <Zap className="h-3 w-3 fill-current" aria-hidden="true" />
            Turbo
            <span className="sr-only">— entrega expressa da rede Primeiro Aqui</span>
          </p>
        )}
      </div>
    </article>
  )
}
