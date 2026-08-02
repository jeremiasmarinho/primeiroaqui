import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

/**
 * Mesmo padrao de fixtures compartilhadas de `productPhotos.test.ts` —
 * usuario fixture criado uma vez em `beforeAll`, reaproveitado entre casos.
 */
describe('rotas de enderecos', () => {
  const createdAddressIds: string[] = []

  let buyerFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let buyerToken: string

  beforeAll(async () => {
    buyerFixture = await createFixtureUser('BUYER')
    buyerToken = await loginToken(buyerFixture.email, buyerFixture.password)
  }, 30_000)

  afterAll(async () => {
    await deleteFixtureUser(buyerFixture.authUserId)
  })

  afterEach(async () => {
    await prisma.address.deleteMany({ where: { id: { in: createdAddressIds } } })
    createdAddressIds.length = 0
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

  const validAddressBody = (overrides: Record<string, unknown> = {}) => ({
    label: 'Casa',
    street: 'Rua Teste, 123',
    city: 'Sao Paulo',
    state: 'SP',
    zipCode: '01000-000',
    latitude: -23.55,
    longitude: -46.63,
    ...overrides,
  })

  describe('POST /addresses', () => {
    it('cria endereco com sucesso, userId sempre do contexto (nunca do body)', async () => {
      const res = await app.request('/addresses', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify(validAddressBody({ userId: '00000000-0000-0000-0000-000000000000' })),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { address: { id: string; userId: string } }
      createdAddressIds.push(body.address.id)
      expect(body.address.userId).toBe(buyerFixture.user.id)
    }, 20_000)

    it('marcar um novo endereco como default desmarca o anterior (exclusividade)', async () => {
      const first = await app.request('/addresses', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify(validAddressBody({ isDefault: true })),
      })
      const firstBody = (await first.json()) as { address: { id: string } }
      createdAddressIds.push(firstBody.address.id)

      const second = await app.request('/addresses', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify(validAddressBody({ isDefault: true })),
      })
      const secondBody = (await second.json()) as { address: { id: string; isDefault: boolean } }
      createdAddressIds.push(secondBody.address.id)
      expect(secondBody.address.isDefault).toBe(true)

      const firstAfter = await prisma.address.findUnique({ where: { id: firstBody.address.id } })
      expect(firstAfter?.isDefault).toBe(false)
    }, 20_000)

    it('body invalido recebe 400', async () => {
      const res = await app.request('/addresses', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ label: 'Casa' }),
      })
      expect(res.status).toBe(400)
    }, 20_000)
  })

  describe('GET /me/addresses', () => {
    it('lista somente os enderecos do proprio usuario', async () => {
      const other = await createFixtureUser('BUYER')
      try {
        const otherToken = await loginToken(other.email, other.password)

        const ownRes = await app.request('/addresses', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
          body: JSON.stringify(validAddressBody()),
        })
        const ownBody = (await ownRes.json()) as { address: { id: string } }
        createdAddressIds.push(ownBody.address.id)

        const otherRes = await app.request('/addresses', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${otherToken}` },
          body: JSON.stringify(validAddressBody()),
        })
        const otherAddrBody = (await otherRes.json()) as { address: { id: string } }

        const listRes = await app.request('/me/addresses', {
          headers: { authorization: `Bearer ${buyerToken}` },
        })
        expect(listRes.status).toBe(200)
        const listBody = (await listRes.json()) as { addresses: Array<{ id: string }> }
        const ids = listBody.addresses.map((a) => a.id)
        expect(ids).toContain(ownBody.address.id)
        expect(ids).not.toContain(otherAddrBody.address.id)

        await prisma.address.deleteMany({ where: { id: otherAddrBody.address.id } })
      } finally {
        await deleteFixtureUser(other.authUserId)
      }
    }, 20_000)
  })
})
