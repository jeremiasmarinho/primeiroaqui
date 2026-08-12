import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRemoteNotifications } from './useRemoteNotifications'
import { api } from '../lib/api'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return { ...actual, api: { ...actual.api, listNotifications: vi.fn(), markNotificationsRead: vi.fn() } }
})

const listNotificationsMock = vi.mocked(api.listNotifications)
const markNotificationsReadMock = vi.mocked(api.markNotificationsRead)

describe('useRemoteNotifications', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('nao busca nada quando enabled=false', async () => {
    renderHook(() => useRemoteNotifications(false))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(listNotificationsMock).not.toHaveBeenCalled()
  })

  it('busca ao montar e expoe notifications/unreadCount', async () => {
    listNotificationsMock.mockResolvedValue({
      notifications: [
        { id: '1', title: 'T', message: 'M', type: 'info', href: null, isRead: false, createdAt: 1000 },
      ],
      unreadCount: 1,
    })

    const { result } = renderHook(() => useRemoteNotifications(true))

    await waitFor(() => expect(result.current.notifications).toHaveLength(1))
    expect(result.current.unreadCount).toBe(1)
  })

  it('markRead chama a API e zera unreadCount otimisticamente', async () => {
    listNotificationsMock.mockResolvedValue({
      notifications: [
        { id: '1', title: 'T', message: 'M', type: 'info', href: null, isRead: false, createdAt: 1000 },
      ],
      unreadCount: 1,
    })
    markNotificationsReadMock.mockResolvedValue({ ok: true })

    const { result } = renderHook(() => useRemoteNotifications(true))
    await waitFor(() => expect(result.current.unreadCount).toBe(1))

    act(() => {
      result.current.markRead()
    })

    expect(result.current.unreadCount).toBe(0)
    await waitFor(() => expect(markNotificationsReadMock).toHaveBeenCalledTimes(1))
  })

  it('nao resurrecta notificacoes apos enabled virar false em pleno voo', async () => {
    let resolveFetch: (value: { notifications: never[]; unreadCount: number }) => void
    listNotificationsMock.mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve }),
    )

    const { result, rerender } = renderHook(({ enabled }) => useRemoteNotifications(enabled), {
      initialProps: { enabled: true },
    })

    rerender({ enabled: false })

    await act(async () => {
      resolveFetch!({
        notifications: [
          { id: '1', title: 'T', message: 'M', type: 'info', href: null, isRead: false, createdAt: 1000 },
        ] as never,
        unreadCount: 1,
      })
      await Promise.resolve()
    })

    expect(result.current.notifications).toHaveLength(0)
    expect(result.current.unreadCount).toBe(0)
  })
})
