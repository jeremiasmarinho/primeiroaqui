import { useCallback, useEffect, useMemo, useState } from 'react'

import { api, ApiError } from '../lib/api'
import { toViewProduct } from '../lib/adapters'
import type { Product } from '../types'

/**
 * Catálogo real: GET /api/products na montagem, com estados de
 * carregamento/erro e retry.
 *
 * Decisão desta fase: uma carga única (limit 50) e filtro de busca/categoria
 * no cliente, como a vitrine já fazia sobre o mock. A busca server-side
 * (`?q=`, geolocalização) fica para a fase de descoberta — o endpoint já
 * existe, só o front não pagina ainda.
 */
export function useRemoteCatalog() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError('')
    api
      .listProducts({ limit: 50 })
      .then(async ({ products: dtos }) => {
        // O DTO de produto traz só o storeId; o nome da loja (vendedor nos
        // cards e na busca) vem de GET /stores/:id — uma chamada por loja
        // distinta, não por produto. Falha em uma loja não derruba o
        // catálogo: o vendedor daquela loja fica vazio.
        const storeIds = Array.from(new Set(dtos.map((dto) => dto.storeId)))
        const stores = await Promise.all(
          storeIds.map((id) => api.getStore(id).catch(() => null)),
        )
        if (cancelled) return
        const nameById = new Map<string, string>()
        for (const result of stores) {
          if (result) nameById.set(result.store.id, result.store.name)
        }
        setProducts(dtos.map((dto) => toViewProduct(dto, nameById.get(dto.storeId))))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(
          err instanceof ApiError && err.status > 0
            ? err.message
            : 'Não foi possível carregar as ofertas. Verifique sua conexão.',
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const retry = useCallback(() => setReloadKey((key) => key + 1), [])

  // Lista real de categorias sai do catálogo carregado — o backend guarda
  // categoria como string livre, não há endpoint de categorias.
  const categories = useMemo(() => {
    const unique = Array.from(new Set(products.map((product) => product.category))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    )
    return ['Tudo', ...unique]
  }, [products])

  return { products, isLoading, error, retry, categories }
}
