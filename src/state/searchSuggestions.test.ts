import { buildSearchSuggestions } from './searchSuggestions'
import { makeProduct } from '../test/factories'
import type { Category, Store } from '../types'

const categories: Category[] = ['Tudo', 'Supermercado', 'Farmácia', 'Casa', 'Eletrônico']

const stores: Store[] = [
  {
    id: 'st1',
    slug: 'mercado-central',
    name: 'Mercado Central',
    category: 'Supermercado',
    rating: 4.8,
    deliveries: 100,
    neighborhood: 'Centro',
    cover: '',
  },
  {
    id: 'st2',
    slug: 'farmacia-local',
    name: 'Farmácia Local',
    category: 'Farmácia',
    rating: 4.7,
    deliveries: 50,
    neighborhood: 'Zona Sul',
    cover: '',
  },
]

const products = [
  makeProduct({ id: 1, title: 'Smartwatch Fitness GPS', category: 'Eletrônico' }),
  makeProduct({ id: 2, title: 'Kit Supermercado Express', category: 'Supermercado' }),
]

const catalog = { products, categories, stores }

describe('buildSearchSuggestions', () => {
  it('termo vazio não gera sugestão', () => {
    expect(buildSearchSuggestions('', catalog)).toEqual([])
    expect(buildSearchSuggestions('   ', catalog)).toEqual([])
  })

  it('encontra categoria pelo nome, ignorando caixa', () => {
    const result = buildSearchSuggestions('farm', catalog)
    expect(result.some((item) => item.kind === 'categoria' && item.label === 'Farmácia')).toBe(true)
  })

  it('nunca sugere a categoria "Tudo"', () => {
    const result = buildSearchSuggestions('tudo', catalog)
    expect(result.some((item) => item.label === 'Tudo')).toBe(false)
  })

  it('encontra loja pelo nome', () => {
    const result = buildSearchSuggestions('mercado', catalog)
    expect(result.some((item) => item.kind === 'loja' && item.label === 'Mercado Central')).toBe(true)
  })

  it('encontra produto pelo título', () => {
    const result = buildSearchSuggestions('smartwatch', catalog)
    expect(result.some((item) => item.kind === 'produto' && item.label === 'Smartwatch Fitness GPS')).toBe(
      true,
    )
  })

  it('não repete o mesmo rótulo duas vezes', () => {
    const result = buildSearchSuggestions('supermercado', catalog)
    const labels = result.map((item) => item.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('respeita o limite informado', () => {
    const result = buildSearchSuggestions('a', catalog, 2)
    expect(result.length).toBeLessThanOrEqual(2)
  })

  it('sem nenhuma correspondência devolve lista vazia', () => {
    expect(buildSearchSuggestions('produto-inexistente-123', catalog)).toEqual([])
  })
})
