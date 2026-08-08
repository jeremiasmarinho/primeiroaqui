import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { Router } from 'wouter'

import NotificationsPanel from './NotificationsPanel'
import type { Notification } from '../types'

const notification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 1,
  title: 'Compra confirmada',
  message: 'Pedido confirmado! Acompanhe em Meus pedidos.',
  type: 'success',
  createdAt: Date.now(),
  ...overrides,
})

describe('NotificationsPanel', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('mostra o tempo relativo de cada notificação', () => {
    const now = Date.now()
    render(
      <Router>
        <NotificationsPanel
          notifications={[notification({ createdAt: now - 5 * 60_000 })]}
          onClose={() => {}}
        />
      </Router>,
    )
    expect(screen.getByText('há 5 min')).toBeInTheDocument()
  })

  it('atualiza o tempo relativo sozinho enquanto o painel está aberto (tick de 30s)', () => {
    vi.useFakeTimers()
    const now = Date.now()
    render(
      <Router>
        <NotificationsPanel
          notifications={[notification({ createdAt: now - 50_000 })]}
          onClose={() => {}}
        />
      </Router>,
    )
    expect(screen.getByText('agora')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByText('há 1 min')).toBeInTheDocument()
  })

  it('limpa o intervalo ao desmontar', () => {
    vi.useFakeTimers()
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = render(
      <Router>
        <NotificationsPanel notifications={[notification()]} onClose={() => {}} />
      </Router>,
    )
    unmount()
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })
})
