import { readStoredJSON, writeStoredJSON } from '../lib/storage'
import { SESSION_STORAGE_KEY } from '../lib/api'
import type { User } from '../types'

export const STORAGE_KEYS = {
  user: 'primeiroaqui_user',
  cart: 'primeiroaqui_cart',
  favorites: 'primeiroaqui_favorites',
  messages: 'primeiroaqui_messages',
  currentOrder: 'primeiroaqui_current_order',
  business: 'primeiroaqui_business',
  notifications: 'primeiroaqui_notifications',
  orders: 'primeiroaqui_orders',
  agents: 'primeiroaqui_agents',
  schedule: 'primeiroaqui_schedule',
  addresses: 'primeiroaqui_addresses',
  searchHistory: 'primeiroaqui_search_history',
} as const

/** Chaves apagadas no logout: tudo que pertence a pessoa, nada de catalogo. */
const SESSION_CLEAR_KEYS: string[] = [
  STORAGE_KEYS.user,
  // Tokens da API (ver src/lib/api.ts) — sessão real morre junto.
  SESSION_STORAGE_KEY,
  STORAGE_KEYS.cart,
  STORAGE_KEYS.favorites,
  STORAGE_KEYS.messages,
  STORAGE_KEYS.currentOrder,
  STORAGE_KEYS.business,
  STORAGE_KEYS.addresses,
  STORAGE_KEYS.searchHistory,
]

export const loadUser = (): User | null => readStoredJSON<User | null>(STORAGE_KEYS.user, null)

export const storeUser = (user: User | null): void => {
  writeStoredJSON(STORAGE_KEYS.user, user)
}

export const clearSession = (): void => {
  SESSION_CLEAR_KEYS.forEach((key) => {
    writeStoredJSON(key, null)
  })
}

export const switchUser = (nextUser: User): void => {
  clearSession()
  storeUser(nextUser)
}
