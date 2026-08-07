import { PackageSearch } from 'lucide-react'
import TopBar from '../components/TopBar'
import ProductCard from '../components/ProductCard'
import { Link } from 'wouter'
import BottomNav from '../components/BottomNav'
import { ROUTES } from '../router/routes'
import type { Category, Notification, Product } from '../types'

interface SectionHeaderProps {
  title: string
  /** Rótulo informativo (ex.: "50 itens") — não é ação, então não vira botão. */
  hint?: string
  id: string
}

function SectionHeader({ title, hint, id }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-4">
      <h2 id={id} className="font-display text-base font-bold text-ink">
        {title}
      </h2>
      {hint && <span className="text-sm font-semibold text-ink-muted">{hint}</span>}
    </div>
  )
}

/**
 * Tela inicial no padrão de app de marketplace: header amarelo fixo, banners,
 * atalhos, ofertas relâmpago, trilho de recomendados e grid de catálogo,
 * com navegação inferior fixa.
 */
interface HomeScreenProps {
  products: Product[]
  allProducts: Product[]
  /** Categorias reais (derivadas do catálogo carregado), com 'Tudo'. */
  categories: Category[]
  isLoading?: boolean
  loadError?: string
  onRetry?: () => void
  category: Category
  searchQuery: string
  onSearchChange: (value: string) => void
  onSearchSubmit: (term: string) => void
  searchRef?: React.RefObject<HTMLInputElement | null>
  favorites: Product[]
  onToggleFavorite: (product: Product) => void
  onAddToCart: (product: Product) => void
  cartCount: number
  notifications: Notification[]
  notificationCount: number
  onNotificationsOpen: () => void
  userName?: string
  userAvatarUrl?: string | null
  /** Endereço padrão da pessoa, quando houver. */
  address?: string
  onOpenCart: () => void
  moreHref?: string
  isAuthenticated: boolean
}

export default function HomeScreen({
  products,
  allProducts,
  categories,
  isLoading = false,
  loadError = '',
  onRetry,
  category,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  searchRef,
  favorites,
  onToggleFavorite,
  onAddToCart,
  cartCount,
  notifications,
  notificationCount,
  onNotificationsOpen,
  userName,
  userAvatarUrl,
  address,
  onOpenCart,
  moreHref,
  isAuthenticated,
}: HomeScreenProps) {
  const isFavorite = (product: Product): boolean => favorites.some((item) => item.id === product.id)
  const initials = (userName || 'Primeiro Aqui')
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-dvh bg-surface-page pb-nav">
      <TopBar
        catalogProducts={allProducts}
        categories={categories}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        searchRef={searchRef}
        category={category}
        userInitials={initials}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        address={address}
        notifications={notifications}
        notificationCount={notificationCount}
        onNotificationsOpen={onNotificationsOpen}
        profileHref={moreHref}
        isAuthenticated={isAuthenticated}
      />

      <main className="mx-auto max-w-6xl">
        {/* Banners de cupom/assinatura, atalhos de fidelidade e "entrega turbo"
            saíram do MVP: nenhum tinha backend por trás (cupom, pontos, indicação,
            frete grátis por assinatura, produto "express") e os CTAs não levavam
            a lugar nenhum — religar quando essas features existirem de verdade. */}

        <section aria-labelledby="catalogo">
          <SectionHeader
            id="catalogo"
            title={category === 'Tudo' ? 'Ofertas do bairro' : category}
            hint={`${products.length} itens`}
          />

          {isLoading ? (
            // Skeleton com a mesma grade dos cards: a tela não "pula" quando
            // o catálogo chega. `animate-pulse` já existe no Tailwind padrão.
            <ul aria-hidden="true" className="grid grid-cols-2 gap-2 px-3 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <li key={index} className="animate-pulse rounded-card bg-surface p-2 shadow-card">
                  <div className="aspect-square w-full rounded-card bg-surface-sunken" />
                  <div className="mt-2 h-4 w-3/4 rounded bg-surface-sunken" />
                  <div className="mt-2 h-4 w-1/2 rounded bg-surface-sunken" />
                </li>
              ))}
            </ul>
          ) : loadError ? (
            <div className="mx-3 rounded-card bg-surface p-8 text-center shadow-card">
              <p role="alert" className="text-sm font-bold text-error">
                {loadError}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="btn-primary min-h-[44px] mt-4 motion-safe:active:scale-95"
              >
                Tentar de novo
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="mx-3 rounded-card bg-surface p-8 text-center shadow-card">
              <PackageSearch className="mx-auto h-10 w-10 text-ink-faint" aria-hidden="true" />
              <p className="mt-3 font-display text-base font-bold text-ink">
                Nenhum produto encontrado
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Tente outro termo de busca ou limpe o filtro de categoria.
              </p>
              <Link
                href={ROUTES.home}
                onClick={() => onSearchChange('')}
                className="btn-primary min-h-[44px] mt-4 motion-safe:active:scale-95"
              >
                Limpar filtros
              </Link>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-2 px-3 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product, index) => (
                <li key={product.id}>
                  <ProductCard
                    product={product}
                    priority={index < 4}
                    isFavorite={isFavorite(product)}
                    onToggleFavorite={onToggleFavorite}
                    onAddToCart={onAddToCart}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="px-3 py-6 text-center text-micro text-ink-faint">
          Primeiro Aqui — marketplace local. Preços e prazos sujeitos à confirmação da loja.
        </p>
      </main>

      <BottomNav
        active="home"
        cartCount={cartCount}
        favoritesCount={favorites.length}
        moreHref={moreHref}
        onNavigate={onOpenCart}
        isAuthenticated={isAuthenticated}
      />
    </div>
  )
}
