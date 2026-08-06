import { afterEach, describe, expect, it } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'
import type { OrderStatus } from '@prisma/client'

/**
 * PATCH /orders/:id/status — integracao contra o Supabase/Postgres reais,
 * mesmo padrao de `storeOwner.test.ts`. Fixtures criadas direto via Prisma
 * (o checkout tem suite propria) e limpas no afterEach.
 */
describe('PATCH /orders/:id/status', () => {
  const createdAuthUserIds: string[] = []
  const createdStoreIds: string[] = []
  const createdOrderIds: string[] = []
  const createdProductIds: string[] = []
  const createdAddressIds: string[] = []

  afterEach(async () => {
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } })
    createdOrderIds.length = 0
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } })
    createdProductIds.length = 0
    await prisma.address.deleteMany({ where: { id: { in: createdAddressIds } } })
    createdAddressIds.length = 0
    await prisma.store.deleteMany({ where: { id: { in: createdStoreIds } } })
    createdStoreIds.length = 0
    await Promise.all(createdAuthUserIds.map((id) => deleteFixtureUser(id)))
    createdAuthUserIds.length = 0
  })

  const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const loginToken = async (email: string, password: string) => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = (await res.json()) as { session: { accessToken: string } }
    return body.session.accessToken
  }

  /** Loja do owner + comprador + pedido no status desejado, tudo via Prisma. */
  const createOrderFixture = async (ownerUserId: string, status: OrderStatus = 'PENDING') => {
    const store = await prisma.store.create({
      data: { ownerId: ownerUserId, name: 'Loja Status', slug: unique('teste-status-loja'), latitude: 0, longitude: 0 },
    })
    createdStoreIds.push(store.id)
    const buyer = await createFixtureUser('BUYER')
    createdAuthUserIds.push(buyer.authUserId)
    const address = await prisma.address.create({
      data: {
        userId: buyer.user.id,
        label: 'Casa',
        street: 'Rua Um, 1',
        city: 'SP',
        state: 'SP',
        zipCode: '01000-000',
        latitude: 0,
        longitude: 0,
      },
    })
    createdAddressIds.push(address.id)
    const order = await prisma.order.create({
      data: { buyerId: buyer.user.id, storeId: store.id, addressId: address.id, totalCents: 1000, status },
    })
    createdOrderIds.push(order.id)
    return order
  }

  const patchStatus = (orderId: string, token: string, status: string) =>
    app.request(`/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    })

  it('dono avanca PENDING → CONFIRMED (200) e persiste', async () => {
    const owner = await createFixtureUser('STORE_OWNER')
    createdAuthUserIds.push(owner.authUserId)
    const order = await createOrderFixture(owner.user.id, 'PENDING')
    const token = await loginToken(owner.email, owner.password)

    const res = await patchStatus(order.id, token, 'CONFIRMED')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { order: { status: string; items: unknown[] } }
    expect(body.order.status).toBe('CONFIRMED')

    const dbOrder = await prisma.order.findUnique({ where: { id: order.id } })
    expect(dbOrder?.status).toBe('CONFIRMED')
  }, 30_000)

  it('dono cancela a partir de CONFIRMED (200)', async () => {
    const owner = await createFixtureUser('STORE_OWNER')
    createdAuthUserIds.push(owner.authUserId)
    const order = await createOrderFixture(owner.user.id, 'CONFIRMED')
    const token = await loginToken(owner.email, owner.password)

    const res = await patchStatus(order.id, token, 'CANCELED')
    expect(res.status).toBe(200)
  }, 30_000)

  it('transicao invalida (PENDING → READY) retorna 409 com mensagem pt-BR', async () => {
    const owner = await createFixtureUser('STORE_OWNER')
    createdAuthUserIds.push(owner.authUserId)
    const order = await createOrderFixture(owner.user.id, 'PENDING')
    const token = await loginToken(owner.email, owner.password)

    const res = await patchStatus(order.id, token, 'READY')
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('inválida')

    const dbOrder = await prisma.order.findUnique({ where: { id: order.id } })
    expect(dbOrder?.status).toBe('PENDING')
  }, 30_000)

  it('cancelar pedido PREPARING retorna 409', async () => {
    const owner = await createFixtureUser('STORE_OWNER')
    createdAuthUserIds.push(owner.authUserId)
    const order = await createOrderFixture(owner.user.id, 'PREPARING')
    const token = await loginToken(owner.email, owner.password)

    const res = await patchStatus(order.id, token, 'CANCELED')
    expect(res.status).toBe(409)
  }, 30_000)

  it('dono de OUTRA loja recebe 403 e nada muda', async () => {
    const owner = await createFixtureUser('STORE_OWNER')
    const other = await createFixtureUser('STORE_OWNER')
    createdAuthUserIds.push(owner.authUserId, other.authUserId)
    const order = await createOrderFixture(owner.user.id, 'PENDING')
    const otherToken = await loginToken(other.email, other.password)

    const res = await patchStatus(order.id, otherToken, 'CONFIRMED')
    expect(res.status).toBe(403)

    const dbOrder = await prisma.order.findUnique({ where: { id: order.id } })
    expect(dbOrder?.status).toBe('PENDING')
  }, 30_000)

  it('ADMIN (nao dono) pode atualizar (200)', async () => {
    const owner = await createFixtureUser('STORE_OWNER')
    const admin = await createFixtureUser('ADMIN')
    createdAuthUserIds.push(owner.authUserId, admin.authUserId)
    const order = await createOrderFixture(owner.user.id, 'PENDING')
    const adminToken = await loginToken(admin.email, admin.password)

    const res = await patchStatus(order.id, adminToken, 'CONFIRMED')
    expect(res.status).toBe(200)
  }, 30_000)

  it('status fora do enum retorna 400; pedido inexistente retorna 404', async () => {
    const owner = await createFixtureUser('STORE_OWNER')
    createdAuthUserIds.push(owner.authUserId)
    const order = await createOrderFixture(owner.user.id, 'PENDING')
    const token = await loginToken(owner.email, owner.password)

    const invalid = await patchStatus(order.id, token, 'ENVIADO')
    expect(invalid.status).toBe(400)

    const missing = await patchStatus('00000000-0000-0000-0000-000000000000', token, 'CONFIRMED')
    expect(missing.status).toBe(404)
  }, 30_000)
})
