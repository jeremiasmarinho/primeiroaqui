import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

/**
 * Mesmo padrao de fixtures de `orders.test.ts`. O unico ponto mockado e o
 * `fetch` global usado por `pagarmeClient.pagarmeRequest` — sem rede real
 * contra o Pagar.me. Auth e banco continuam reais (mesmo padrao do resto da
 * suite de servidor).
 */
describe('rotas de pagamento (Pagar.me, sandbox)', () => {
  const createdStoreIds: string[] = []
  const createdProductIds: string[] = []
  const createdAddressIds: string[] = []
  const createdOrderIds: string[] = []

  let buyerFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let otherBuyerFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let ownerFixture: Awaited<ReturnType<typeof createFixtureUser>>
  let buyerToken: string
  let otherBuyerToken: string

  beforeAll(async () => {
    buyerFixture = await createFixtureUser('BUYER')
    otherBuyerFixture = await createFixtureUser('BUYER')
    ownerFixture = await createFixtureUser('STORE_OWNER')
    buyerToken = await loginToken(buyerFixture.email, buyerFixture.password)
    otherBuyerToken = await loginToken(otherBuyerFixture.email, otherBuyerFixture.password)
  }, 30_000)

  afterAll(async () => {
    await Promise.all([
      deleteFixtureUser(buyerFixture.authUserId),
      deleteFixtureUser(otherBuyerFixture.authUserId),
      deleteFixtureUser(ownerFixture.authUserId),
    ])
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    delete process.env.PAGARME_REQUIRE_ACTIVE_RECIPIENT
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } })
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } })
    createdOrderIds.length = 0
    await prisma.address.deleteMany({ where: { id: { in: createdAddressIds } } })
    createdAddressIds.length = 0
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } })
    createdProductIds.length = 0
    await prisma.store.deleteMany({ where: { id: { in: createdStoreIds } } })
    createdStoreIds.length = 0
  })

  beforeEach(() => {
    process.env.PAGARME_SECRET_KEY = 'sk_test_fixture'
    process.env.PAGARME_PLATFORM_RECIPIENT_ID = 'rp_platform_fixture'
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

  const createStoreFixture = async (overrides: Partial<{ pagarmeRecipientId: string; recipientStatus: string }> = {}) => {
    const store = await prisma.store.create({
      data: {
        ownerId: ownerFixture.user.id,
        name: 'Loja Teste Pagamentos',
        slug: unique('teste-pagamentos-loja'),
        latitude: -23.55,
        longitude: -46.63,
        isActive: true,
        pagarmeRecipientId: overrides.pagarmeRecipientId ?? 'rp_store_fixture',
        recipientStatus: overrides.recipientStatus ?? 'active',
      },
    })
    createdStoreIds.push(store.id)
    return store
  }

  const createProductFixture = async (storeId: string) => {
    const product = await prisma.product.create({
      data: {
        storeId,
        title: 'Produto Teste Pagamentos',
        category: unique('categoria'),
        priceCents: 5000,
        stock: 10,
        isActive: true,
      },
    })
    createdProductIds.push(product.id)
    return product
  }

  const createAddressFixture = async (userId: string) => {
    const address = await prisma.address.create({
      data: {
        userId,
        label: 'Casa',
        street: 'Rua Teste, 123',
        city: 'Sao Paulo',
        state: 'SP',
        zipCode: '01000-000',
        latitude: -23.55,
        longitude: -46.63,
      },
    })
    createdAddressIds.push(address.id)
    return address
  }

  const createOrderFixture = async (buyerId: string, storeId: string, addressId: string, productId: string) => {
    const order = await prisma.order.create({
      data: {
        buyerId,
        storeId,
        addressId,
        totalCents: 10000,
        items: { create: [{ productId, quantity: 2, unitPriceCents: 5000 }] },
      },
      include: { items: true },
    })
    createdOrderIds.push(order.id)
    return order
  }

  const validCustomer = { name: 'Comprador Teste', email: 'comprador@example.com', document: '11122233344', documentType: 'CPF' }

  /**
   * `fetch` global tambem e usado pelo cliente do Supabase Auth
   * (`requireUser` chama `supabasePublic.auth.getUser`) — mockar
   * `globalThis.fetch` sem filtro quebraria a autenticacao real da suite.
   * Este helper so intercepta chamadas para `api.pagar.me`; qualquer outra
   * URL passa para o `fetch` real.
   */
  const mockPagarmeFetch = (response: Response) => {
    const realFetch = globalThis.fetch.bind(globalThis)
    return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('api.pagar.me')) {
        return Promise.resolve(response.clone())
      }
      return realFetch(input, init)
    })
  }

  describe('POST /orders/:id/pay', () => {
    it('Pix: cria a order no Pagar.me, persiste pagarmeOrderId/paymentStatus=PENDING e retorna qr_code', async () => {
      const store = await createStoreFixture()
      const product = await createProductFixture(store.id)
      const address = await createAddressFixture(buyerFixture.user.id)
      const order = await createOrderFixture(buyerFixture.user.id, store.id, address.id, product.id)

      mockPagarmeFetch(
        new Response(
          JSON.stringify({
            id: 'ord_pagarme_1',
            status: 'pending',
            charges: [{ id: 'ch_1', status: 'pending', last_transaction: { qr_code: '000201...', qr_code_url: 'https://pagar.me/qr/1', expires_at: '2026-08-07T12:00:00Z' } }],
          }),
          { status: 200 },
        ),
      )

      const res = await app.request(`/orders/${order.id}/pay`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ method: 'pix', customer: validCustomer }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { pix: { qrCode: string }; order: { paymentStatus: string } }
      expect(body.pix.qrCode).toBe('000201...')
      expect(body.order.paymentStatus).toBe('PENDING')

      const updated = await prisma.order.findUnique({ where: { id: order.id } })
      expect(updated?.pagarmeOrderId).toBe('ord_pagarme_1')
      expect(updated?.platformFeeCents).toBe(500)
      expect(updated?.storeAmountCents).toBe(9500)
    })

    it('cartao com numero cru (card.number) e rejeitado com 400, sem chamar o Pagar.me', async () => {
      const store = await createStoreFixture()
      const product = await createProductFixture(store.id)
      const address = await createAddressFixture(buyerFixture.user.id)
      const order = await createOrderFixture(buyerFixture.user.id, store.id, address.id, product.id)

      const fetchSpy = mockPagarmeFetch(new Response(JSON.stringify({}), { status: 200 }))

      const res = await app.request(`/orders/${order.id}/pay`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ method: 'credit_card', customer: validCustomer, card: { number: '4111111111111111' } }),
      })

      expect(res.status).toBe(400)
      const pagarmeCalls = fetchSpy.mock.calls.filter(([input]) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
        return url.includes('api.pagar.me')
      })
      expect(pagarmeCalls).toHaveLength(0)
    })

    it('403 (nao-encontrado) se o pedido for de outro comprador', async () => {
      const store = await createStoreFixture()
      const product = await createProductFixture(store.id)
      const address = await createAddressFixture(buyerFixture.user.id)
      const order = await createOrderFixture(buyerFixture.user.id, store.id, address.id, product.id)

      const res = await app.request(`/orders/${order.id}/pay`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${otherBuyerToken}` },
        body: JSON.stringify({ method: 'pix', customer: validCustomer }),
      })

      expect(res.status).toBe(404)
    })

    it('bloqueia o pagamento quando PAGARME_REQUIRE_ACTIVE_RECIPIENT=true e a loja nao esta active', async () => {
      process.env.PAGARME_REQUIRE_ACTIVE_RECIPIENT = 'true'
      const store = await createStoreFixture({ recipientStatus: 'registration' })
      const product = await createProductFixture(store.id)
      const address = await createAddressFixture(buyerFixture.user.id)
      const order = await createOrderFixture(buyerFixture.user.id, store.id, address.id, product.id)

      const fetchSpy = mockPagarmeFetch(new Response(JSON.stringify({}), { status: 200 }))

      const res = await app.request(`/orders/${order.id}/pay`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ method: 'pix', customer: validCustomer }),
      })

      expect(res.status).toBe(409)
      const pagarmeCalls = fetchSpy.mock.calls.filter(([input]) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
        return url.includes('api.pagar.me')
      })
      expect(pagarmeCalls).toHaveLength(0)
    })

    it('permite o pagamento por default (PAGARME_REQUIRE_ACTIVE_RECIPIENT nao setado) mesmo com loja nao-active', async () => {
      const store = await createStoreFixture({ recipientStatus: 'registration' })
      const product = await createProductFixture(store.id)
      const address = await createAddressFixture(buyerFixture.user.id)
      const order = await createOrderFixture(buyerFixture.user.id, store.id, address.id, product.id)

      mockPagarmeFetch(new Response(JSON.stringify({ id: 'ord_pagarme_2', status: 'pending', charges: [] }), { status: 200 }))

      const res = await app.request(`/orders/${order.id}/pay`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ method: 'pix', customer: validCustomer }),
      })

      expect(res.status).toBe(200)
    })
  })

  describe('GET /orders/:id/payment', () => {
    it('retorna o status atual do pagamento para o dono do pedido', async () => {
      const store = await createStoreFixture()
      const product = await createProductFixture(store.id)
      const address = await createAddressFixture(buyerFixture.user.id)
      const order = await createOrderFixture(buyerFixture.user.id, store.id, address.id, product.id)

      const res = await app.request(`/orders/${order.id}/payment`, {
        headers: { authorization: `Bearer ${buyerToken}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { paymentStatus: string }
      expect(body.paymentStatus).toBe('NONE')
    })

    it('404 se o pedido for de outro comprador', async () => {
      const store = await createStoreFixture()
      const product = await createProductFixture(store.id)
      const address = await createAddressFixture(buyerFixture.user.id)
      const order = await createOrderFixture(buyerFixture.user.id, store.id, address.id, product.id)

      const res = await app.request(`/orders/${order.id}/payment`, {
        headers: { authorization: `Bearer ${otherBuyerToken}` },
      })
      expect(res.status).toBe(404)
    })
  })

  describe('POST /webhooks/pagarme', () => {
    it('nao exige autenticacao e sempre responde 200', async () => {
      const res = await app.request('/webhooks/pagarme', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'order.paid', data: { order: { id: 'ord-inexistente' } } }),
      })
      expect(res.status).toBe(200)
    })

    it('aplica order.paid e e idempotente numa re-entrega', async () => {
      const store = await createStoreFixture()
      const product = await createProductFixture(store.id)
      const address = await createAddressFixture(buyerFixture.user.id)
      const order = await createOrderFixture(buyerFixture.user.id, store.id, address.id, product.id)
      await prisma.order.update({ where: { id: order.id }, data: { pagarmeOrderId: 'ord_webhook_1' } })

      const send = () =>
        app.request('/webhooks/pagarme', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'order.paid', data: { order: { id: 'ord_webhook_1' } } }),
        })

      const res1 = await send()
      expect(res1.status).toBe(200)
      const res2 = await send()
      expect(res2.status).toBe(200)

      const updated = await prisma.order.findUnique({ where: { id: order.id } })
      expect(updated?.paymentStatus).toBe('PAID')
    })
  })
})
