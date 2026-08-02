import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Link } from 'wouter'

import { categories, products, stores } from '../data/catalog'
import { ROUTES, toCategorySlug } from '../router/routes'

/**
 * Tela de categorias.
 *
 * Antes, a aba "Categorias" da barra inferior apenas focava o campo de busca —
 * um botão que fingia navegar. Agora é uma tela com endereço próprio.
 */
export default function CategoriesScreen() {
  const realCategories = categories.filter((category) => category !== 'Tudo')

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
        <h1 className="text-sm font-bold text-navy">Categorias</h1>
      </header>

      <main className="mx-auto max-w-4xl px-3 py-4">
        <ul className="overflow-hidden rounded-card bg-surface shadow-card">
          {realCategories.map((category) => {
            const count = products.filter((product) => product.category === category).length
            return (
              <li key={category} className="border-b border-line last:border-b-0">
                <Link
                  href={ROUTES.category(toCategorySlug(category))}
                  className="flex min-h-[56px] items-center justify-between gap-3 px-4 transition-colors duration-150 hover:bg-surface-sunken"
                >
                  <span className="font-display font-bold text-ink">{category}</span>
                  <span className="flex items-center gap-2 text-sm text-ink-muted">
                    <span className="tabular">{count} itens</span>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>

        <h2 className="px-1 pb-2 pt-6 font-display text-base font-bold text-ink">Lojas do bairro</h2>
        <ul className="overflow-hidden rounded-card bg-surface shadow-card">
          {stores.map((store) => (
            <li key={store.id} className="border-b border-line last:border-b-0">
              <Link
                href={ROUTES.store(store.slug)}
                className="flex min-h-[56px] items-center justify-between gap-3 px-4 transition-colors duration-150 hover:bg-surface-sunken"
              >
                <span>
                  <span className="block font-display font-bold text-ink">{store.name}</span>
                  <span className="block text-micro text-ink-muted">{store.neighborhood}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-ink-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
