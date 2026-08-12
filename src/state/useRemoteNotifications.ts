import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Notification } from '../types'

/** Intervalo de polling do painel de notificações. */
const POLL_INTERVAL_MS = 30_000

/**
 * Notificações reais: GET /me/notifications ao montar, a cada
 * `POLL_INTERVAL_MS` e quando a aba volta a ficar visível. `enabled=false`
 * (sem sessão) não busca nada — mesmo padrão de `useAddressesState`.
 */
export function useRemoteNotifications(enabled: boolean) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    if (!enabled) return
    try {
      const { notifications: dtos, unreadCount: count } = await api.listNotifications()
      setNotifications(
        dtos.map((dto) => ({
          id: dto.id,
          title: dto.title,
          message: dto.message,
          type: dto.type,
          href: dto.href ?? undefined,
          createdAt: dto.createdAt,
        })),
      )
      setUnreadCount(count)
    } catch {
      // Silencioso: notificações são conveniência, não bloqueiam o app.
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    void fetchNotifications()
    const interval = setInterval(() => void fetchNotifications(), POLL_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void fetchNotifications()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, fetchNotifications])

  const markRead = useCallback(() => {
    setUnreadCount(0)
    api.markNotificationsRead().catch(() => {
      // Silencioso: pior caso, o contador reaparece na próxima busca.
    })
  }, [])

  return { notifications, unreadCount, markRead }
}
