import { afterEach, describe, expect, it } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

/**
 * Testes de integracao para `GET /stores` (listagem publica) — mesmo padrao
 * de `stores.test.ts`: fixtures via API admin do Supabase, limpeza no
 * `afterEach`.
 */
describe('GET /stores (listagem publica)', () => {
  const createdAuthUserIds: string[] = []
  const createdStoreIds: string[] = []

  afterEach(async () => {
    await prisma.store.deleteMany({ where: { id: { in: createdStoreIds } } })
    createdStoreIds.length = 0
    await Promise.all(createdAuthUserIds.map((id) => deleteFixtureUser(id)))
    createdAuthUserIds.length = 0
  })

  const uniqueSlug = (prefix: string) =>
    `teste-storeslist-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`

  it('retorna lojas ativas ordenadas por nome, com category', async () => {
    const fixture = await createFixtureUser('STORE_OWNER')
    createdAuthUserIds.push(fixture.authUserId)

    const storeB = await prisma.store.create({
      data: {
        ownerId: fixture.user.id,
        name: 'Zebra Mercado',
        slug: uniqueSlug('zebra'),
        latitude: -23.55,
        longitude: -46.63,
        category: 'MERCADO',
      },
    })
    const storeA = await prisma.store.create({
      data: {
        ownerId: fixture.user.id,
        name: 'Alfa Padaria',
        slug: uniqueSlug('alfa'),
        latitude: -23.55,
        longitude: -46.63,
        category: 'PADARIA',
      },
    })
    createdStoreIds.push(storeA.id, storeB.id)

    const res = await app.request('/stores')
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      stores: Array<{ id: string; name: string; slug: string; description: string | null; category: string }>
    }
    const ids = body.stores.map((s) => s.id)
    expect(ids.indexOf(storeA.id)).toBeLessThan(ids.indexOf(storeB.id))

    const found = body.stores.find((s) => s.id === storeA.id)
    expect(found?.category).toBe('PADARIA')
  }, 20_000)

  it('nao retorna lojas inativas', async () => {
    const fixture = await createFixtureUser('STORE_OWNER')
    createdAuthUserIds.push(fixture.authUserId)

    const inactive = await prisma.store.create({
      data: {
        ownerId: fixture.user.id,
        name: 'Loja Inativa',
        slug: uniqueSlug('inativa'),
        latitude: -23.55,
        longitude: -46.63,
        isActive: false,
      },
    })
    createdStoreIds.push(inactive.id)

    const res = await app.request('/stores')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { stores: Array<{ id: string }> }
    expect(body.stores.some((s) => s.id === inactive.id)).toBe(false)
  }, 20_000)

  it('filtra por ?category=', async () => {
    const fixture = await createFixtureUser('STORE_OWNER')
    createdAuthUserIds.push(fixture.authUserId)

    const mercado = await prisma.store.create({
      data: {
        ownerId: fixture.user.id,
        name: 'Mercado Filtro',
        slug: uniqueSlug('mercado-filtro'),
        latitude: -23.55,
        longitude: -46.63,
        category: 'MERCADO',
      },
    })
    const farmacia = await prisma.store.create({
      data: {
        ownerId: fixture.user.id,
        name: 'Farmacia Filtro',
        slug: uniqueSlug('farmacia-filtro'),
        latitude: -23.55,
        longitude: -46.63,
        category: 'FARMACIA',
      },
    })
    createdStoreIds.push(mercado.id, farmacia.id)

    const res = await app.request('/stores?category=MERCADO')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { stores: Array<{ id: string; category: string }> }
    expect(body.stores.some((s) => s.id === farmacia.id)).toBe(false)
    const found = body.stores.find((s) => s.id === mercado.id)
    expect(found?.category).toBe('MERCADO')
  }, 20_000)

  it('category invalida retorna 400', async () => {
    const res = await app.request('/stores?category=INVALIDA')
    expect(res.status).toBe(400)
  })
})
