import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

describe('rotas de notificacoes', () => {
  let buyerFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let otherBuyerFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let buyerToken: string
  let otherBuyerToken: string

  beforeAll(async () => {
    buyerFixture = await createFixtureUser('BUYER')
    otherBuyerFixture = await createFixtureUser('BUYER')
    buyerToken = await loginToken(buyerFixture.email, buyerFixture.password)
    otherBuyerToken = await loginToken(otherBuyerFixture.email, otherBuyerFixture.password)
  }, 30_000)

  afterAll(async () => {
    await Promise.all([
      deleteFixtureUser(buyerFixture.authUserId),
      deleteFixtureUser(otherBuyerFixture.authUserId),
    ])
  })

  afterEach(async () => {
    await prisma.notification.deleteMany({
      where: { userId: { in: [buyerFixture.user.id, otherBuyerFixture.user.id] } },
    })
  })

  const loginToken = async (email: string, password: string) => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = (await res.json()) as { session: { accessToken: string } }
    return body.session.accessToken
  }

  describe('GET /me/notifications', () => {
    it('lista somente as notificacoes do proprio usuario, mais recentes primeiro', async () => {
      await prisma.notification.create({
        data: { userId: buyerFixture.user.id, title: 'Mais antiga', message: 'M1', type: 'INFO' },
      })
      await prisma.notification.create({
        data: { userId: buyerFixture.user.id, title: 'Mais nova', message: 'M2', type: 'SUCCESS' },
      })
      await prisma.notification.create({
        data: { userId: otherBuyerFixture.user.id, title: 'De outro usuario', message: 'M3', type: 'INFO' },
      })

      const res = await app.request('/me/notifications', {
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        notifications: Array<{ title: string; type: string; isRead: boolean }>
        unreadCount: number
      }
      expect(body.notifications.map((n) => n.title)).toEqual(['Mais nova', 'Mais antiga'])
      expect(body.notifications.every((n) => n.type === n.type.toLowerCase())).toBe(true)
      expect(body.unreadCount).toBe(2)
    }, 20_000)

    it('401 sem token', async () => {
      const res = await app.request('/me/notifications')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /me/notifications/read', () => {
    it('marca todas as notificacoes do usuario como lidas (idempotente)', async () => {
      await prisma.notification.create({
        data: { userId: buyerFixture.user.id, title: 'A', message: 'M', type: 'INFO' },
      })
      await prisma.notification.create({
        data: { userId: buyerFixture.user.id, title: 'B', message: 'M', type: 'INFO' },
      })

      const first = await app.request('/me/notifications/read', {
        method: 'POST',
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(first.status).toBe(200)

      const afterFirst = await app.request('/me/notifications', {
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      const afterFirstBody = (await afterFirst.json()) as { unreadCount: number }
      expect(afterFirstBody.unreadCount).toBe(0)

      const second = await app.request('/me/notifications/read', {
        method: 'POST',
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(second.status).toBe(200)
    }, 20_000)

    it('nao afeta notificacoes de outro usuario', async () => {
      await prisma.notification.create({
        data: { userId: otherBuyerFixture.user.id, title: 'A', message: 'M', type: 'INFO' },
      })

      await app.request('/me/notifications/read', {
        method: 'POST',
        headers: { authorization: `Bearer ${buyerToken}` },
      })

      const res = await app.request('/me/notifications', {
        headers: { authorization: `Bearer ${otherBuyerToken}` },
      })
      const body = (await res.json()) as { unreadCount: number }
      expect(body.unreadCount).toBe(1)
    }, 20_000)
  })
})
