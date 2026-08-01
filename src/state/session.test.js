import {
  clearSession,
  loadUser,
  STORAGE_KEYS,
  storeUser,
  switchUser,
} from './session'
import { readStoredJSON } from '../lib/storage'

describe('session state', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('login grava usuario', () => {
    storeUser({ name: 'Ana', role: 'client' })
    expect(loadUser()).toEqual({ name: 'Ana', role: 'client' })
  })

  it('regressao B3: logout limpa dados sensiveis de sessao', () => {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ name: 'Ana' }))
    localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify({ items: [{ quantity: 1 }] }))
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify([{ id: 1 }]))
    localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify([{ id: 1 }]))
    localStorage.setItem(STORAGE_KEYS.currentOrder, JSON.stringify({ id: '1001' }))
    localStorage.setItem(STORAGE_KEYS.business, JSON.stringify({ name: 'Loja' }))

    clearSession()

    expect(localStorage.getItem(STORAGE_KEYS.user)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.cart)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.favorites)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.messages)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.currentOrder)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.business)).toBeNull()
  })

  it('regressao B4: estado nulo remove chave do storage', () => {
    storeUser({ name: 'Ana', role: 'client' })
    storeUser(null)
    expect(localStorage.getItem(STORAGE_KEYS.user)).toBeNull()
  })

  it('troca de usuario nao vaza dados do anterior', () => {
    storeUser({ name: 'Ana', role: 'client' })
    localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify({ items: [{ quantity: 2 }] }))

    switchUser({ name: 'Bruno', role: 'client' })

    expect(readStoredJSON(STORAGE_KEYS.user, null)).toEqual({ name: 'Bruno', role: 'client' })
    expect(localStorage.getItem(STORAGE_KEYS.cart)).toBeNull()
  })
})
