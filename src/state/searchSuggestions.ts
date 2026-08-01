import type { Category, Product, Store } from '../types'

export type SearchSuggestionKind = 'produto' | 'categoria' | 'loja'

export interface SearchSuggestion {
  id: string
  label: string
  kind: SearchSuggestionKind
}

interface CatalogSource {
  products: Product[]
  categories: Category[]
  stores: Store[]
}

/** Rótulo legível do tipo de sugestão, usado no dropdown. */
export const SUGGESTION_KIND_LABEL: Record<SearchSuggestionKind, string> = {
  produto: 'Produto',
  categoria: 'Categoria',
  loja: 'Loja',
}

/** Acima disso a lista de sugestões vira rolagem sem fim, não atalho. */
export const MAX_SUGGESTIONS = 6

/**
 * Sugestões derivadas do catálogo para o termo digitado — sem chamada de
 * rede, é tudo dado que o app já carregou. Prioriza categoria e loja (termos
 * curtos, decisão rápida) e completa com título de produto.
 */
export const buildSearchSuggestions = (
  term: string,
  { products, categories, stores }: CatalogSource,
  limit: number = MAX_SUGGESTIONS,
): SearchSuggestion[] => {
  const query = term.trim().toLowerCase()
  if (!query) return []

  const seen = new Set<string>()
  const suggestions: SearchSuggestion[] = []

  const tryAdd = (label: string, kind: SearchSuggestionKind) => {
    if (suggestions.length >= limit) return
    const key = `${kind}:${label.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    suggestions.push({ id: key, label, kind })
  }

  categories
    .filter((category) => category !== 'Tudo' && category.toLowerCase().includes(query))
    .forEach((category) => tryAdd(category, 'categoria'))

  stores
    .filter((store) => store.name.toLowerCase().includes(query))
    .forEach((store) => tryAdd(store.name, 'loja'))

  products
    .filter((product) => product.title.toLowerCase().includes(query))
    .forEach((product) => tryAdd(product.title, 'produto'))

  return suggestions
}
