import { Hono } from 'hono'
import { prisma } from '../lib/prismaClient'
import { requireUser, type AuthEnv } from '../middleware/auth'

export const notificationRoutes = new Hono<AuthEnv>()

const NOTIFICATIONS_LIMIT = 50

notificationRoutes.get('/me/notifications', requireUser, async (c) => {
  const authedUser = c.get('authedUser')

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: authedUser.id },
      orderBy: { createdAt: 'desc' },
      take: NOTIFICATIONS_LIMIT,
    }),
    prisma.notification.count({ where: { userId: authedUser.id, isRead: false } }),
  ])

  return c.json({
    notifications: notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type.toLowerCase() as 'info' | 'success' | 'warning',
      href: notification.href,
      isRead: notification.isRead,
      createdAt: notification.createdAt.getTime(),
    })),
    unreadCount,
  })
})

/** Idempotente: marcar como lida de novo nao e erro, so um no-op. */
notificationRoutes.post('/me/notifications/read', requireUser, async (c) => {
  const authedUser = c.get('authedUser')
  await prisma.notification.updateMany({
    where: { userId: authedUser.id, isRead: false },
    data: { isRead: true },
  })
  return c.json({ ok: true })
})
