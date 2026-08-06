import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Link } from 'wouter'

import { LoadingBlock, ErrorBlock } from '../components/ScreenShell'
import { ROUTES, toCategorySlug } from '../router/routes'
import type { Category, Product } from '../types'

interface CategoriesScreenProps {
  /** Categorias reais derivadas do catálogo carregado (inclui 'Tudo'). */
  categories: Category[]
  products: Product[]
  isLoading?: boolean
  error?: string
}

/**
 * Tela de categorias, agora sobre o catálogo real: a lista é derivada dos
 * produtos carregados da API (o backend guarda categoria como string livre,
 * não há endpoint de categorias).
 *
 * A seção "Lojas do bairro" (mock) saiu nesta fase: os links apontavam para
 * lojas de demonstração que não existem na API — esconder o ponto de entrada
 * é melhor do que deixá-lo quebrado. Volta na fase de descoberta.
 */
export default function CategoriesScreen({
  categories,
  products,
  isLoading = false,
  error = '',
}: CategoriesScreenProps) {
  const realCategories = categories.filter((category) => category !== 'Tudo')

  const body = () => {
    if (isLoading) return <LoadingBlock label="Carregando categorias…" />
    if (error) return <ErrorBlock message={error} />
    return (
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
    )
  }

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

      <main className="mx-auto max-w-4xl px-3 py-4">{body()}</main>
    </div>
  )
}
