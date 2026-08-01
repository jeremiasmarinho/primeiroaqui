import { Heart } from 'lucide-react'

import BottomNav from '../components/BottomNav'
import ProductCard from '../components/ProductCard'
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  ScreenHeader,
  itemsLabel,
} from '../components/ScreenShell'
import type { Product } from '../types'

interface FavoritesScreenProps {
  favorites: Product[]
  onToggleFavorite: (product: Product) => void
  onAddToCart: (product: Product) => void
  onOpenCart: () => void
  cartCount: number
  moreHref?: string
  isLoading?: boolean
  error?: string
}

/**
 * Lista de produtos salvos, com endereço próprio.
 *
 * O card reaproveitado do catálogo já traz o botão de favoritar com
 * `aria-pressed` e alvo de 44px — desfavoritar aqui é o mesmo controle de lá,
 * não um botão paralelo que poderia divergir.
 */
export default function FavoritesScreen({
  favorites,
  onToggleFavorite,
  onAddToCart,
  onOpenCart,
  cartCount,
  moreHref,
  isLoading = false,
  error = '',
}: FavoritesScreenProps) {
  const body = () => {
    if (isLoading) return <LoadingBlock label="Carregando favoritos…" />
    if (error) return <ErrorBlock message={error} />
    if (favorites.length === 0) {
      return (
        <EmptyBlock
          Icon={Heart}
          title="Nenhum favorito salvo"
          message="Toque no coração de um produto para guardá-lo aqui e comparar depois."
        />
      )
    }

    return (
      <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {favorites.map((product, index) => (
          <li key={product.id}>
            <ProductCard
              product={product}
              priority={index < 4}
              isFavorite
              onToggleFavorite={onToggleFavorite}
              onAddToCart={onAddToCart}
            />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="min-h-dvh bg-surface-page pb-nav">
      <ScreenHeader title="Favoritos" count={itemsLabel(favorites.length)} />
      <main className="mx-auto max-w-6xl px-3 py-4">{body()}</main>
      <BottomNav
        active="favorites"
        cartCount={cartCount}
        favoritesCount={favorites.length}
        moreHref={moreHref}
        onNavigate={onOpenCart}
      />
    </div>
  )
}
