import { describe, expect, it, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { Router } from 'wouter'
import type { ReactNode } from 'react'

import { useCatalogState } from './useCatalogState'
import { STORAGE_KEYS } from './session'

const wrapper = ({ children }: { children: ReactNode }) => <Router>{children}</Router>

describe('useCatalogState — migração de notificações antigas', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('adiciona createdAt a notificações persistidas sem o campo (storage pré-cronômetro)', () => {
    localStorage.setItem(
      STORAGE_KEYS.notifications,
      JSON.stringify([{ id: 1, title: 'Compra confirmada', message: 'Pedido ok', type: 'success' }]),
    )

    const before = Date.now()
    const { result } = renderHook(() => useCatalogState(), { wrapper })
    const after = Date.now()

    expect(result.current.notifications).toHaveLength(1)
    const migrated = result.current.notifications[0]!
    expect(typeof migrated.createdAt).toBe('number')
    expect(migrated.createdAt).toBeGreaterThanOrEqual(before)
    expect(migrated.createdAt).toBeLessThanOrEqual(after)
  })

  it('preserva createdAt já presente sem sobrescrever', () => {
    const original = 1_000_000
    localStorage.setItem(
      STORAGE_KEYS.notifications,
      JSON.stringify([
        { id: 1, title: 'Compra confirmada', message: 'Pedido ok', type: 'success', createdAt: original },
      ]),
    )

    const { result } = renderHook(() => useCatalogState(), { wrapper })
    expect(result.current.notifications[0]!.createdAt).toBe(original)
  })

  it('addNotification grava Date.now() como createdAt', () => {
    const { result } = renderHook(() => useCatalogState(), { wrapper })
    const before = Date.now()

    act(() => {
      result.current.addNotification('Título', 'Mensagem', 'info')
    })
    const after = Date.now()

    expect(result.current.notifications).toHaveLength(1)
    const created = result.current.notifications[0]!.createdAt
    expect(created).toBeGreaterThanOrEqual(before)
    expect(created).toBeLessThanOrEqual(after)
  })
})
