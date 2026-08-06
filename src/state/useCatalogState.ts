import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'wouter'

import { readStoredJSON } from '../lib/storage'
import { STORAGE_KEYS } from './session'
import { initialNotifications, initialThreads } from './marketplaceSeed'
import type { Notification, Product, Thread } from '../types'

/** Busca, favoritos, notificações e mensagens exibidas na vitrine. */
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
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    readStoredJSON(STORAGE_KEYS.notifications, initialNotifications),
  )
  // Nao lidas: quantas notificacoes existem desde a ultima vez que o sino foi
  // aberto. Nao precisa persistir — reabrir o app com o sino fechado e ok
  // mostrar tudo como nao lido de novo, e evita mais uma chave de storage.
  const [unreadCount, setUnreadCount] = useState(() => notifications.length)
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

  const addNotification = (title: string, message: string, type: Notification['type'] = 'info') => {
    setNotifications((prev) => [{ id: prev.length + 1, title, message, type }, ...prev].slice(0, 4))
    setUnreadCount((prev) => prev + 1)
  }

  const markNotificationsRead = () => setUnreadCount(0)

  return {
    searchQuery,
    setSearchQuery,
    searchInputRef,
    favorites,
    setFavorites,
    toggleFavorite,
    notifications,
    setNotifications,
    unreadCount,
    markNotificationsRead,
    addNotification,
    messageThreads,
    setMessageThreads,
  }
}
