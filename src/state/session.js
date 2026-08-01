import { readStoredJSON, writeStoredJSON } from '../lib/storage'

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
}

const SESSION_CLEAR_KEYS = [
  STORAGE_KEYS.user,
  STORAGE_KEYS.cart,
  STORAGE_KEYS.favorites,
  STORAGE_KEYS.messages,
  STORAGE_KEYS.currentOrder,
  STORAGE_KEYS.business,
]

export const loadUser = () => readStoredJSON(STORAGE_KEYS.user, null)

export const storeUser = (user) => {
  writeStoredJSON(STORAGE_KEYS.user, user)
}

export const clearSession = () => {
  SESSION_CLEAR_KEYS.forEach((key) => {
    writeStoredJSON(key, null)
  })
}

export const switchUser = (nextUser) => {
  clearSession()
  storeUser(nextUser)
}
