import { ChevronRight, PackageSearch } from 'lucide-react'
import TopBar from '../components/TopBar.jsx'
import BannerCarousel from '../components/BannerCarousel.jsx'
import ShortcutRail from '../components/ShortcutRail.jsx'
import FlashDeals from '../components/FlashDeals.jsx'
import ProductCard from '../components/ProductCard.jsx'
import BottomNav from '../components/BottomNav.jsx'

function SectionHeader({ title, action, id }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-4">
      <h2 id={id} className="font-display text-base font-bold text-ink">
        {title}
      </h2>
      {action && (
        <button
          type="button"
          className="flex min-h-[44px] items-center gap-0.5 text-sm font-bold text-ink"
        >
          {action}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/**
 * Tela inicial no padrão de app de marketplace: header amarelo fixo, banners,
 * atalhos, ofertas relâmpago, trilho de recomendados e grid de catálogo,
 * com navegação inferior fixa.
 */
export default function HomeScreen({
  products,
  allProducts,
  category,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  searchRef,
  favorites,
  onToggleFavorite,
  onOpenProduct,
  onAddToCart,
  cartCount,
  notificationCount,
  userName,
  onOpenCart,
  onOpenProfile,
  onNavigate,
}) {
  const isFavorite = (product) => favorites.some((item) => item.id === product.id)
  const initials = (userName || 'Primeiro Aqui')
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()

  // Com filtro de categoria ou busca ativa, os blocos de descoberta saem de
  // cena: mostrar produtos fora do filtro ao lado do resultado filtrado
  // contradiz o que a pessoa acabou de pedir.
  const isBrowsing = category === 'Tudo' && searchQuery.trim() === ''
  const recommended = allProducts.filter((product) => product.express).slice(0, 6)

  return (
    <div className="min-h-dvh bg-surface-page pb-nav">
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        searchRef={searchRef}
        category={category}
        onCategoryChange={onCategoryChange}
        userInitials={initials}
        userName={userName}
        notificationCount={notificationCount}
        onProfile={onOpenProfile}
        onNotifications={() => onNavigate?.('more')}
      />

      <main className="mx-auto max-w-6xl">
        {isBrowsing && (
          <>
            <BannerCarousel />
            <ShortcutRail onSelect={() => onCategoryChange('Tudo')} />
            <FlashDeals products={allProducts} onOpen={onOpenProduct} />

            <section aria-labelledby="recomendados">
              <SectionHeader id="recomendados" title="Entrega turbo perto de você" action="Ver mais" />
              <ul className="rail no-scrollbar px-3 pb-1">
                {recommended.map((product) => (
                  <li key={product.id}>
                    <ProductCard
                      product={product}
                      variant="wide"
                      isFavorite={isFavorite(product)}
                      onOpen={onOpenProduct}
                      onToggleFavorite={onToggleFavorite}
                      onAddToCart={onAddToCart}
                    />
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        <section aria-labelledby="catalogo">
          <SectionHeader
            id="catalogo"
            title={category === 'Tudo' ? 'Ofertas do bairro' : category}
            action={`${products.length} itens`}
          />

          {products.length === 0 ? (
            <div className="mx-3 rounded-card bg-surface p-8 text-center shadow-card">
              <PackageSearch className="mx-auto h-10 w-10 text-ink-faint" aria-hidden="true" />
              <p className="mt-3 font-display text-base font-bold text-ink">
                Nenhum produto encontrado
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Tente outro termo de busca ou limpe o filtro de categoria.
              </p>
              <button
                type="button"
                onClick={() => {
                  onSearchChange('')
                  onCategoryChange('Tudo')
                }}
                className="mt-4 min-h-[44px] rounded-full bg-ink px-5 text-sm font-bold text-white
                           transition-transform duration-150 motion-safe:active:scale-95"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-2 px-3 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <li key={product.id}>
                  <ProductCard
                    product={product}
                    isFavorite={isFavorite(product)}
                    onOpen={onOpenProduct}
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
        onNavigate={(id) => (id === 'cart' ? onOpenCart() : onNavigate?.(id))}
      />
    </div>
  )
}
