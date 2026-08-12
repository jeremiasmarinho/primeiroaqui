import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from './prismaClient'
import { createNotification } from './notifications'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

describe('createNotification', () => {
  let userFixture: Awaited<ReturnType<typeof createFixtureUser>>

  it('cria a notificação com os campos informados', async () => {
    userFixture = await createFixtureUser('BUYER')
    try {
      await createNotification(userFixture.user.id, {
        title: 'Título teste',
        message: 'Mensagem teste',
        type: 'SUCCESS',
        href: '/pedidos',
      })

      const created = await prisma.notification.findFirst({
        where: { userId: userFixture.user.id },
      })
      expect(created).not.toBeNull()
      expect(created?.title).toBe('Título teste')
      expect(created?.message).toBe('Mensagem teste')
      expect(created?.type).toBe('SUCCESS')
      expect(created?.href).toBe('/pedidos')
      expect(created?.isRead).toBe(false)
    } finally {
      await prisma.notification.deleteMany({ where: { userId: userFixture.user.id } })
      await deleteFixtureUser(userFixture.authUserId)
    }
  }, 20_000)

  it('type é opcional e usa INFO como padrão', async () => {
    const fixture = await createFixtureUser('BUYER')
    try {
      await createNotification(fixture.user.id, { title: 'T', message: 'M' })
      const created = await prisma.notification.findFirst({ where: { userId: fixture.user.id } })
      expect(created?.type).toBe('INFO')
    } finally {
      await prisma.notification.deleteMany({ where: { userId: fixture.user.id } })
      await deleteFixtureUser(fixture.authUserId)
    }
  }, 20_000)

  it('nao lanca erro se a escrita falhar (userId inexistente = violação de FK)', async () => {
    await expect(
      createNotification('00000000-0000-0000-0000-000000000000', {
        title: 'T',
        message: 'M',
      }),
    ).resolves.toBeUndefined()

    const count = await prisma.notification.count({
      where: { userId: '00000000-0000-0000-0000-000000000000' },
    })
    expect(count).toBe(0)
  }, 20_000)
})
