import { describe, expect, it } from 'vitest'
import * as catalog from './catalog'

/**
 * WU-43 — guard contra dado órfão.
 *
 * Dado exportado que nenhuma tela consome é pior que dado ausente: sugere que
 * existe funcionalidade quando não existe. Este teste falha se alguém exportar
 * algo de `src/data` sem ligar a lugar nenhum.
 */
const sources = import.meta.glob('../{components,screens,lib,state}/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const appSources = Object.entries(sources)
  .filter(([path]) => !path.includes('.test.'))
  .map(([, code]) => code)
  .join('\n')

describe('exports do catalogo', () => {
  it('todo export e consumido por algum componente, tela ou modulo de estado', () => {
    const orphans = Object.keys(catalog).filter((name) => !appSources.includes(name))
    expect(orphans, `exports sem consumidor: ${orphans.join(', ')}`).toEqual([])
  })
})

describe('integridade do catalogo', () => {
  it('nao ha id de produto duplicado', () => {
    const ids = catalog.products.map((product) => product.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('todo produto tem preco de lista maior ou igual ao preco de venda', () => {
    catalog.products.forEach((product) => {
      expect(product.listPrice).toBeGreaterThanOrEqual(product.price)
    })
  })

  it('toda categoria de produto existe na lista de categorias', () => {
    catalog.products.forEach((product) => {
      expect(catalog.categories).toContain(product.category)
    })
  })

  it('todo vendedor de produto tem loja cadastrada', () => {
    const storeNames = catalog.stores.map((store) => store.name)
    catalog.products.forEach((product) => {
      expect(storeNames, `vendedor sem loja: ${product.seller}`).toContain(product.seller)
    })
  })

  it('nao ha slug de loja duplicado', () => {
    const slugs = catalog.stores.map((store) => store.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('a nota de todo produto esta entre 0 e 5', () => {
    catalog.products.forEach((product) => {
      expect(product.rating).toBeGreaterThanOrEqual(0)
      expect(product.rating).toBeLessThanOrEqual(5)
    })
  })
})
