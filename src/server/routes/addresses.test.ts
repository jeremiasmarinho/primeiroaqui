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
    street: 'Rua Teste',
    number: '123',
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

    it('numero presente dispensa complemento', async () => {
      const res = await app.request('/addresses', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify(validAddressBody({ number: '148', complement: undefined })),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { address: { id: string } }
      createdAddressIds.push(body.address.id)
    }, 20_000)

    it('sem numero, sem complemento recebe 400', async () => {
      const res = await app.request('/addresses', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify(validAddressBody({ number: undefined })),
      })
      expect(res.status).toBe(400)
    }, 20_000)

    it('sem numero mas com complemento (casa s/n) passa', async () => {
      const res = await app.request('/addresses', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify(
          validAddressBody({ number: undefined, complement: 'Casa amarela, ao lado do mercado' }),
        ),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { address: { id: string } }
      createdAddressIds.push(body.address.id)
    }, 20_000)

    it('salva e devolve o bairro (neighborhood)', async () => {
      const res = await app.request('/addresses', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify(validAddressBody({ neighborhood: 'Centro' })),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { address: { id: string; neighborhood: string | null } }
      createdAddressIds.push(body.address.id)
      expect(body.address.neighborhood).toBe('Centro')
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

  const createAddress = async (token: string, overrides: Record<string, unknown> = {}) => {
    const res = await app.request('/addresses', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(validAddressBody(overrides)),
    })
    const body = (await res.json()) as { address: { id: string; isDefault: boolean } }
    createdAddressIds.push(body.address.id)
    return body.address
  }

  describe('PATCH /addresses/:id', () => {
    it('edita label/rua/numero/complemento/cidade/estado/cep e retorna o endereco atualizado', async () => {
      const created = await createAddress(buyerToken)

      const res = await app.request(`/addresses/${created.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify(
          validAddressBody({ label: 'Trabalho', street: 'Rua Nova', city: 'Campinas' }),
        ),
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { address: { label: string; street: string; city: string } }
      expect(body.address.label).toBe('Trabalho')
      expect(body.address.street).toBe('Rua Nova')
      expect(body.address.city).toBe('Campinas')
    }, 20_000)

    it('mesma regra numero/complemento do POST: sem numero e sem complemento recebe 400', async () => {
      const created = await createAddress(buyerToken)

      const res = await app.request(`/addresses/${created.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify(validAddressBody({ number: undefined, complement: undefined })),
      })
      expect(res.status).toBe(400)
    }, 20_000)

    it('editar endereco de outro usuario recebe 403', async () => {
      const other = await createFixtureUser('BUYER')
      try {
        const otherToken = await loginToken(other.email, other.password)
        const created = await createAddress(otherToken)

        const res = await app.request(`/addresses/${created.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
          body: JSON.stringify(validAddressBody()),
        })
        expect(res.status).toBe(403)
      } finally {
        await prisma.address.deleteMany({ where: { userId: other.user.id } })
        await deleteFixtureUser(other.authUserId)
      }
    }, 20_000)

    it('editar endereco inexistente recebe 404', async () => {
      const res = await app.request('/addresses/00000000-0000-0000-0000-000000000000', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify(validAddressBody()),
      })
      expect(res.status).toBe(404)
    }, 20_000)
  })

  describe('PATCH /addresses/:id/default', () => {
    it('define como padrao e desmarca os anteriores', async () => {
      const first = await createAddress(buyerToken, { isDefault: true })
      const second = await createAddress(buyerToken)

      const res = await app.request(`/addresses/${second.id}/default`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { address: { isDefault: boolean } }
      expect(body.address.isDefault).toBe(true)

      const firstAfter = await prisma.address.findUnique({ where: { id: first.id } })
      expect(firstAfter?.isDefault).toBe(false)
    }, 20_000)

    it('definir padrao de endereco de outro usuario recebe 403', async () => {
      const other = await createFixtureUser('BUYER')
      try {
        const otherToken = await loginToken(other.email, other.password)
        const created = await createAddress(otherToken)

        const res = await app.request(`/addresses/${created.id}/default`, {
          method: 'PATCH',
          headers: { authorization: `Bearer ${buyerToken}` },
        })
        expect(res.status).toBe(403)
      } finally {
        await prisma.address.deleteMany({ where: { userId: other.user.id } })
        await deleteFixtureUser(other.authUserId)
      }
    }, 20_000)
  })

  describe('DELETE /addresses/:id', () => {
    it('exclui um endereco que nao e padrao', async () => {
      const created = await createAddress(buyerToken)
      createdAddressIds.splice(createdAddressIds.indexOf(created.id), 1)

      const res = await app.request(`/addresses/${created.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(res.status).toBe(200)

      const after = await prisma.address.findUnique({ where: { id: created.id } })
      expect(after).toBeNull()
    }, 20_000)

    it('excluir o padrao promove o mais recente dos que sobraram', async () => {
      const first = await createAddress(buyerToken, { isDefault: true })
      const second = await createAddress(buyerToken)
      createdAddressIds.splice(createdAddressIds.indexOf(first.id), 1)

      const res = await app.request(`/addresses/${first.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(res.status).toBe(200)

      const secondAfter = await prisma.address.findUnique({ where: { id: second.id } })
      expect(secondAfter?.isDefault).toBe(true)
    }, 20_000)

    it('excluir endereco de outro usuario recebe 403', async () => {
      const other = await createFixtureUser('BUYER')
      try {
        const otherToken = await loginToken(other.email, other.password)
        const created = await createAddress(otherToken)

        const res = await app.request(`/addresses/${created.id}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${buyerToken}` },
        })
        expect(res.status).toBe(403)
      } finally {
        await prisma.address.deleteMany({ where: { userId: other.user.id } })
        await deleteFixtureUser(other.authUserId)
      }
    }, 20_000)
  })
})
