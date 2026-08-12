import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'wouter'

import { readStoredJSON } from '../lib/storage'
import { STORAGE_KEYS } from './session'
import { initialThreads } from './marketplaceSeed'
import type { Product, Thread } from '../types'

/** Busca, favoritos e mensagens exibidas na vitrine. Notificações vêm de `useRemoteNotifications`. */
export function useCatalogState() {
  const [searchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '')

  // A URL e a fonte de verdade do termo buscado: abrir /busca?q=x por link
  // precisa preencher o campo, senao o deep link mostra resultado sem contexto.
  useEffect(() => {
    setSearchQuery(searchParams.get('q') ?? '')
  }, [searchParams])
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [favorites, setFavorites] = useState<Product[]>(() =>
    readStoredJSON<Product[]>(STORAGE_KEYS.favorites, []),
  )
  const [messageThreads, setMessageThreads] = useState<Thread[]>(() =>
    readStoredJSON(STORAGE_KEYS.messages, initialThreads),
  )

  const toggleFavorite = (product: Product) => {
    setFavorites((prev) =>
      prev.some((item) => item.id === product.id)
        ? prev.filter((item) => item.id !== product.id)
        : [...prev, product],
    )
  }

  return {
    searchQuery,
    setSearchQuery,
    searchInputRef,
    favorites,
    setFavorites,
    toggleFavorite,
    messageThreads,
    setMessageThreads,
  }
}
