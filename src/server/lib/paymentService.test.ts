import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./pagarmeClient', async () => {
  const actual = await vi.importActual<typeof import('./pagarmeClient')>('./pagarmeClient')
  return { ...actual, pagarmeRequest: vi.fn() }
})

vi.mock('./prismaClient', () => ({
  prisma: {
    store: { update: vi.fn(), updateMany: vi.fn() },
    order: { update: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
  },
}))

vi.mock('./notifications', () => ({ createNotification: vi.fn() }))

import { pagarmeRequest, PagarmeApiError } from './pagarmeClient'
import { prisma } from './prismaClient'
import { createNotification } from './notifications'
import {
  buildRecipientPayload,
  buildSplitRules,
  calculateSplitCents,
  createRecipientForStore,
  createPaymentOrder,
  handleWebhook,
  MarketplaceNotEnabledError,
  type OrderWithItemsAndStore,
} from './paymentService'

const pagarmeRequestMock = vi.mocked(pagarmeRequest)

describe('buildRecipientPayload', () => {
  const bankAccount = {
    holder_name: 'Loja Teste',
    holder_type: 'individual' as const,
    holder_document: '11122233344',
    bank: '001',
    branch_number: '1234',
    account_number: '56789',
    account_check_digit: '0',
    type: 'checking' as const,
  }

  it('monta payload PF com register_information.type=individual', () => {
    const payload = buildRecipientPayload({
      personType: 'individual',
      document: '11122233344',
      name: 'Joao da Silva',
      email: 'joao@example.com',
      birthdate: '1990-01-01',
      monthlyIncome: 300000,
      professionalOccupation: 'Comerciante',
      bankAccount,
    })
    expect(payload.register_information.type).toBe('individual')
    expect(payload.default_bank_account).toBe(bankAccount)
  })

  it('monta payload PJ com register_information.type=corporation', () => {
    const payload = buildRecipientPayload({
      personType: 'company',
      document: '11222333000181',
      companyName: 'Loja Teste LTDA',
      tradingName: 'Loja Teste',
      email: 'contato@lojateste.com',
      annualRevenue: 1200000,
      bankAccount,
    })
    expect(payload.register_information.type).toBe('corporation')
  })
})

describe('buildSplitRules — regra de negocio 2026-08-07 (plataforma 5% liquido)', () => {
  afterEach(() => {
    delete process.env.PLATFORM_FEE_PERCENT
    delete process.env.PAGARME_PLATFORM_RECIPIENT_ID
  })

  it('percentuais somam 100', () => {
    process.env.PAGARME_PLATFORM_RECIPIENT_ID = 'rp_platform'
    const rules = buildSplitRules('rp_store')
    const total = rules.reduce((sum, rule) => sum + rule.amount, 0)
    expect(total).toBe(100)
  })

  it('a rule da plataforma e liable e NAO paga taxa de processamento; a da loja paga', () => {
    process.env.PAGARME_PLATFORM_RECIPIENT_ID = 'rp_platform'
    const rules = buildSplitRules('rp_store')
    const platformRule = rules.find((r) => r.recipient_id === 'rp_platform')!
    const storeRule = rules.find((r) => r.recipient_id === 'rp_store')!

    expect(platformRule.options.liable).toBe(true)
    expect(platformRule.options.charge_processing_fee).toBe(false)
    expect(platformRule.options.charge_remainder_fee).toBe(false)

    expect(storeRule.options.liable).toBe(false)
    expect(storeRule.options.charge_processing_fee).toBe(true)
    expect(storeRule.options.charge_remainder_fee).toBe(true)
  })

  it('usa 5% default para a plataforma', () => {
    process.env.PAGARME_PLATFORM_RECIPIENT_ID = 'rp_platform'
    const rules = buildSplitRules('rp_store')
    const platformRule = rules.find((r) => r.recipient_id === 'rp_platform')!
    const storeRule = rules.find((r) => r.recipient_id === 'rp_store')!
    expect(platformRule.amount).toBe(5)
    expect(storeRule.amount).toBe(95)
  })
})

describe('calculateSplitCents', () => {
  afterEach(() => {
    delete process.env.PLATFORM_FEE_PERCENT
  })

  it('calcula 5% para a plataforma e 95% para a loja por default', () => {
    const result = calculateSplitCents(10000)
    expect(result.platformFeeCents).toBe(500)
    expect(result.storeAmountCents).toBe(9500)
  })

  it('platformFeeCents + storeAmountCents === totalCents (sem perda de centavos no arredondamento)', () => {
    const result = calculateSplitCents(9999)
    expect(result.platformFeeCents + result.storeAmountCents).toBe(9999)
  })
})

describe('createRecipientForStore', () => {
  beforeEach(() => {
    pagarmeRequestMock.mockReset()
    vi.mocked(prisma.store.update).mockReset()
  })

  it('chama POST /recipients e persiste pagarmeRecipientId/recipientStatus', async () => {
    pagarmeRequestMock.mockResolvedValue({ id: 'rp_123', status: 'pending' })
    vi.mocked(prisma.store.update).mockResolvedValue({ id: 'store_1', pagarmeRecipientId: 'rp_123', recipientStatus: 'pending' } as never)

    const store = { id: 'store_1' } as never
    await createRecipientForStore(store, {
      personType: 'individual',
      document: '11122233344',
      name: 'Joao',
      email: 'joao@example.com',
      birthdate: '1990-01-01',
      monthlyIncome: 300000,
      professionalOccupation: 'Comerciante',
      bankAccount: {
        holder_name: 'Joao',
        holder_type: 'individual',
        holder_document: '11122233344',
        bank: '001',
        branch_number: '1234',
        account_number: '56789',
        account_check_digit: '0',
        type: 'checking',
      },
    })

    expect(pagarmeRequestMock).toHaveBeenCalledWith('/recipients', expect.objectContaining({ method: 'POST' }))
    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { id: 'store_1' },
      data: { pagarmeRecipientId: 'rp_123', recipientStatus: 'pending' },
    })
  })

  it('mapeia o 412 "not allowed to create a recipient" para MarketplaceNotEnabledError (gate de afiliacao confirmado em sandbox 2026-08-07)', async () => {
    pagarmeRequestMock.mockRejectedValue(
      new PagarmeApiError('Pagar.me respondeu 412 em /recipients', 412, {
        message: 'This company is not allowed to create a recipient',
      }),
    )

    const store = { id: 'store_1' } as never
    await expect(
      createRecipientForStore(store, {
        personType: 'individual',
        document: '11122233344',
        name: 'Joao',
        email: 'joao@example.com',
        birthdate: '1990-01-01',
        monthlyIncome: 300000,
        professionalOccupation: 'Comerciante',
        bankAccount: {
          holder_name: 'Joao',
          holder_type: 'individual',
          holder_document: '11122233344',
          bank: '001',
          branch_number: '1234',
          account_number: '56789',
          account_check_digit: '0',
          type: 'checking',
        },
      }),
    ).rejects.toBeInstanceOf(MarketplaceNotEnabledError)
    expect(prisma.store.update).not.toHaveBeenCalled()
  })

  it('outros erros da API (ex.: 422 de validacao) passam adiante sem virar MarketplaceNotEnabledError', async () => {
    pagarmeRequestMock.mockRejectedValue(new PagarmeApiError('Pagar.me respondeu 422 em /recipients', 422, { message: 'invalid' }))

    const store = { id: 'store_1' } as never
    await expect(
      createRecipientForStore(store, {
        personType: 'individual',
        document: '11122233344',
        name: 'Joao',
        email: 'joao@example.com',
        birthdate: '1990-01-01',
        monthlyIncome: 300000,
        professionalOccupation: 'Comerciante',
        bankAccount: {
          holder_name: 'Joao',
          holder_type: 'individual',
          holder_document: '11122233344',
          bank: '001',
          branch_number: '1234',
          account_number: '56789',
          account_check_digit: '0',
          type: 'checking',
        },
      }),
    ).rejects.not.toBeInstanceOf(MarketplaceNotEnabledError)
  })
})

describe('createPaymentOrder', () => {
  beforeEach(() => {
    pagarmeRequestMock.mockReset()
    vi.mocked(prisma.order.update).mockReset()
    process.env.PAGARME_PLATFORM_RECIPIENT_ID = 'rp_platform'
  })

  afterEach(() => {
    delete process.env.PAGARME_PLATFORM_RECIPIENT_ID
    delete process.env.PLATFORM_FEE_PERCENT
  })

  const baseOrder = {
    id: 'order_1',
    totalCents: 10000,
    store: { id: 'store_1', pagarmeRecipientId: 'rp_store' },
    items: [{ productId: 'p1', quantity: 2, unitPriceCents: 5000 }],
  } as unknown as OrderWithItemsAndStore

  const customer = { name: 'Maria', email: 'maria@example.com', document: '11122233344', documentType: 'CPF' as const }

  it('sem PAGARME_PLATFORM_RECIPIENT_ID: cria a order SEM split (100% conta master), mas ainda calcula/persiste platformFeeCents/storeAmountCents', async () => {
    delete process.env.PAGARME_PLATFORM_RECIPIENT_ID
    pagarmeRequestMock.mockResolvedValue({ id: 'ord_sem_split', status: 'pending', charges: [] })
    vi.mocked(prisma.order.update).mockResolvedValue({ id: 'order_1', paymentStatus: 'PENDING' } as never)

    await createPaymentOrder(baseOrder, { method: 'pix', customer })

    const [, init] = pagarmeRequestMock.mock.calls[0]!
    const body = init!.body as { payments: Array<{ payment_method: string; split?: unknown }> }
    expect(body.payments[0]!.split).toBeUndefined()

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { pagarmeOrderId: 'ord_sem_split', paymentStatus: 'PENDING', platformFeeCents: 500, storeAmountCents: 9500 },
    })
  })

  it('sem Store.pagarmeRecipientId (mesmo com PAGARME_PLATFORM_RECIPIENT_ID setado): cria a order SEM split', async () => {
    pagarmeRequestMock.mockResolvedValue({ id: 'ord_sem_split_2', status: 'pending', charges: [] })
    vi.mocked(prisma.order.update).mockResolvedValue({ id: 'order_1', paymentStatus: 'PENDING' } as never)

    const orderSemRecipient = { ...baseOrder, store: { id: 'store_1', pagarmeRecipientId: null } } as unknown as OrderWithItemsAndStore
    await createPaymentOrder(orderSemRecipient, { method: 'pix', customer })

    const [, init] = pagarmeRequestMock.mock.calls[0]!
    const body = init!.body as { payments: Array<{ payment_method: string; split?: unknown }> }
    expect(body.payments[0]!.split).toBeUndefined()
  })

  it('Pix: com loja e plataforma configuradas, monta payload com split e persiste pagarmeOrderId/paymentStatus=PENDING', async () => {
    pagarmeRequestMock.mockResolvedValue({ id: 'ord_pagarme_1', status: 'pending', charges: [] })
    vi.mocked(prisma.order.update).mockResolvedValue({ id: 'order_1', paymentStatus: 'PENDING' } as never)

    await createPaymentOrder(baseOrder, { method: 'pix', customer })

    const [, init] = pagarmeRequestMock.mock.calls[0]!
    const body = init!.body as { payments: Array<{ payment_method: string; split: Array<{ amount: number }> }> }
    expect(body.payments[0]!.payment_method).toBe('pix')
    const totalSplit = body.payments[0]!.split.reduce((s, r) => s + r.amount, 0)
    expect(totalSplit).toBe(100)

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { pagarmeOrderId: 'ord_pagarme_1', paymentStatus: 'PENDING', platformFeeCents: 500, storeAmountCents: 9500 },
    })
  })

  it('cartao: usa cardToken tokenizado no payload (nunca numero de cartao)', async () => {
    pagarmeRequestMock.mockResolvedValue({ id: 'ord_pagarme_2', status: 'pending', charges: [] })
    vi.mocked(prisma.order.update).mockResolvedValue({ id: 'order_1', paymentStatus: 'PENDING' } as never)

    await createPaymentOrder(baseOrder, { method: 'credit_card', customer, cardToken: 'card_token_abc' })

    const [, init] = pagarmeRequestMock.mock.calls[0]!
    const body = init!.body as { payments: Array<{ payment_method: string; credit_card: { card_token: string } }> }
    expect(body.payments[0]!.credit_card.card_token).toBe('card_token_abc')
  })

  it('cada item leva `code` (productId) — confirmado obrigatorio pelo sandbox real', async () => {
    pagarmeRequestMock.mockResolvedValue({ id: 'ord_pagarme_3', status: 'pending', charges: [] })
    vi.mocked(prisma.order.update).mockResolvedValue({ id: 'order_1', paymentStatus: 'PENDING' } as never)

    await createPaymentOrder(baseOrder, { method: 'pix', customer })

    const [, init] = pagarmeRequestMock.mock.calls[0]!
    const body = init!.body as { items: Array<{ code: string }> }
    expect(body.items[0]!.code).toBe('p1')
  })

  it('customer.phones.mobile_phone e propagado quando o customer informa phone', async () => {
    pagarmeRequestMock.mockResolvedValue({ id: 'ord_pagarme_4', status: 'pending', charges: [] })
    vi.mocked(prisma.order.update).mockResolvedValue({ id: 'order_1', paymentStatus: 'PENDING' } as never)

    await createPaymentOrder(baseOrder, {
      method: 'pix',
      customer: { ...customer, phone: { countryCode: '55', areaCode: '11', number: '999999999' } },
    })

    const [, init] = pagarmeRequestMock.mock.calls[0]!
    const body = init!.body as { customer: { phones?: { mobile_phone?: { area_code: string } } } }
    expect(body.customer.phones?.mobile_phone?.area_code).toBe('11')
  })

  it('cartao: billing_address vai em credit_card.card.billing_address quando informado (confirmado pelo sandbox real)', async () => {
    pagarmeRequestMock.mockResolvedValue({ id: 'ord_pagarme_5', status: 'paid', charges: [] })
    vi.mocked(prisma.order.update).mockResolvedValue({ id: 'order_1', paymentStatus: 'PENDING' } as never)

    await createPaymentOrder(baseOrder, {
      method: 'credit_card',
      customer,
      cardToken: 'card_token_abc',
      billingAddress: { line1: 'Rua Teste, 123', zipCode: '01000000', city: 'Sao Paulo', state: 'SP', country: 'BR' },
    })

    const [, init] = pagarmeRequestMock.mock.calls[0]!
    const body = init!.body as {
      payments: Array<{ credit_card: { card?: { billing_address?: { line_1: string; city: string } } } }>
    }
    expect(body.payments[0]!.credit_card.card?.billing_address).toEqual(
      expect.objectContaining({ line_1: 'Rua Teste, 123', city: 'Sao Paulo' }),
    )
  })

  it('cartao: sem billingAddress, credit_card.card fica ausente (nao manda objeto vazio)', async () => {
    pagarmeRequestMock.mockResolvedValue({ id: 'ord_pagarme_6', status: 'pending', charges: [] })
    vi.mocked(prisma.order.update).mockResolvedValue({ id: 'order_1', paymentStatus: 'PENDING' } as never)

    await createPaymentOrder(baseOrder, { method: 'credit_card', customer, cardToken: 'card_token_abc' })

    const [, init] = pagarmeRequestMock.mock.calls[0]!
    const body = init!.body as { payments: Array<{ credit_card: { card?: unknown } }> }
    expect(body.payments[0]!.credit_card.card).toBeUndefined()
  })

  describe('google_pay', () => {
    const googlePayToken = {
      protocolVersion: 'ECv2',
      signature: 'assinatura-do-google',
      signedMessage: '{"encryptedMessage":"..."}',
      intermediateSigningKey: { signedKey: 'chave', signatures: ['s1'] },
    }

    it('monta payment_method=credit_card com credit_card.payload.type=google_pay (nunca cardToken)', async () => {
      pagarmeRequestMock.mockResolvedValue({ id: 'ord_gpay_1', status: 'paid', charges: [] })
      vi.mocked(prisma.order.update).mockResolvedValue({ id: 'order_1', paymentStatus: 'PENDING' } as never)

      await createPaymentOrder(baseOrder, {
        method: 'google_pay',
        customer,
        googlePayToken,
        gatewayMerchantId: 'acc_platform_123',
      })

      const [, init] = pagarmeRequestMock.mock.calls[0]!
      const body = init!.body as {
        payments: Array<{
          payment_method: string
          credit_card: { card_token?: string; payload?: { type: string; google_pay: Record<string, unknown> } }
        }>
      }
      expect(body.payments[0]!.payment_method).toBe('credit_card')
      expect(body.payments[0]!.credit_card.card_token).toBeUndefined()
      expect(body.payments[0]!.credit_card.payload).toEqual({
        type: 'google_pay',
        google_pay: {
          version: 'ECv2',
          signature: 'assinatura-do-google',
          intermediate_signing_key: { signedKey: 'chave', signatures: ['s1'] },
          signed_message: '{"encryptedMessage":"..."}',
          merchant_identifier: 'acc_platform_123',
        },
      })
    })

    it('billing_address vai em credit_card.card.billing_address quando informado, igual ao cartao classico', async () => {
      pagarmeRequestMock.mockResolvedValue({ id: 'ord_gpay_2', status: 'paid', charges: [] })
      vi.mocked(prisma.order.update).mockResolvedValue({ id: 'order_1', paymentStatus: 'PENDING' } as never)

      await createPaymentOrder(baseOrder, {
        method: 'google_pay',
        customer,
        googlePayToken,
        gatewayMerchantId: 'acc_platform_123',
        billingAddress: { line1: 'Rua Teste, 123', zipCode: '01000000', city: 'Sao Paulo', state: 'SP', country: 'BR' },
      })

      const [, init] = pagarmeRequestMock.mock.calls[0]!
      const body = init!.body as { payments: Array<{ credit_card: { card?: { billing_address?: { city: string } } } }> }
      expect(body.payments[0]!.credit_card.card?.billing_address).toEqual(
        expect.objectContaining({ city: 'Sao Paulo' }),
      )
    })

    it('split condicional preservado: com loja+plataforma configuradas, o split vai no payment do google_pay', async () => {
      pagarmeRequestMock.mockResolvedValue({ id: 'ord_gpay_3', status: 'paid', charges: [] })
      vi.mocked(prisma.order.update).mockResolvedValue({ id: 'order_1', paymentStatus: 'PENDING' } as never)

      await createPaymentOrder(baseOrder, {
        method: 'google_pay',
        customer,
        googlePayToken,
        gatewayMerchantId: 'acc_platform_123',
      })

      const [, init] = pagarmeRequestMock.mock.calls[0]!
      const body = init!.body as { payments: Array<{ split?: Array<{ amount: number }> }> }
      const totalSplit = body.payments[0]!.split!.reduce((s, r) => s + r.amount, 0)
      expect(totalSplit).toBe(100)
    })

    it('split condicional preservado: sem PAGARME_PLATFORM_RECIPIENT_ID, google_pay tambem cai para 100% conta master', async () => {
      delete process.env.PAGARME_PLATFORM_RECIPIENT_ID
      pagarmeRequestMock.mockResolvedValue({ id: 'ord_gpay_4', status: 'paid', charges: [] })
      vi.mocked(prisma.order.update).mockResolvedValue({ id: 'order_1', paymentStatus: 'PENDING' } as never)

      await createPaymentOrder(baseOrder, {
        method: 'google_pay',
        customer,
        googlePayToken,
        gatewayMerchantId: 'acc_platform_123',
      })

      const [, init] = pagarmeRequestMock.mock.calls[0]!
      const body = init!.body as { payments: Array<{ split?: unknown }> }
      expect(body.payments[0]!.split).toBeUndefined()
    })

    it('persiste pagarmeOrderId/paymentStatus=PENDING igual ao fluxo de cartao', async () => {
      pagarmeRequestMock.mockResolvedValue({ id: 'ord_gpay_5', status: 'paid', charges: [] })
      vi.mocked(prisma.order.update).mockResolvedValue({ id: 'order_1', paymentStatus: 'PENDING' } as never)

      await createPaymentOrder(baseOrder, {
        method: 'google_pay',
        customer,
        googlePayToken,
        gatewayMerchantId: 'acc_platform_123',
      })

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order_1' },
        data: { pagarmeOrderId: 'ord_gpay_5', paymentStatus: 'PENDING', platformFeeCents: 500, storeAmountCents: 9500 },
      })
    })
  })
})

describe('handleWebhook', () => {
  beforeEach(() => {
    vi.mocked(prisma.order.updateMany).mockReset()
    vi.mocked(prisma.order.findFirst).mockReset()
    vi.mocked(prisma.store.updateMany).mockReset()
    vi.mocked(createNotification).mockReset()
  })

  it('order.paid -> paymentStatus PAID', async () => {
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 })
    await handleWebhook({ type: 'order.paid', data: { order: { id: 'ord_1' } } })
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { pagarmeOrderId: 'ord_1' },
      data: { paymentStatus: 'PAID' },
    })
  })

  it('order.paid notifica o comprador na primeira confirmacao', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      buyerId: 'buyer_1',
      paymentStatus: 'PENDING',
      totalCents: 10000,
    } as never)
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 })

    await handleWebhook({ type: 'order.paid', data: { order: { id: 'ord_1' } } })

    // `formatCents` usa Intl.NumberFormat pt-BR, que insere um NBSP (não um
    // espaço comum) entre "R$" e o valor — ver o mesmo cuidado em
    // `src/server/routes/orders.test.ts` e `src/lib/money.test.ts`.
    expect(createNotification).toHaveBeenCalledWith(
      'buyer_1',
      expect.objectContaining({
        title: 'Pagamento confirmado',
        message: expect.stringContaining('100,00'),
        type: 'SUCCESS',
        href: '/pedidos',
      }),
    )
    expect(vi.mocked(createNotification).mock.calls[0]?.[1].message).toMatch(/^Pagamento de R\$ 100,00 confirmado!/)
  })

  it('order.paid reaplicado (ja estava PAID) nao notifica de novo', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      buyerId: 'buyer_1',
      paymentStatus: 'PAID',
      totalCents: 10000,
    } as never)
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 })

    await handleWebhook({ type: 'order.paid', data: { order: { id: 'ord_1' } } })

    expect(createNotification).not.toHaveBeenCalled()
  })

  it('order.paid sem pedido correspondente nao notifica', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 0 })

    await handleWebhook({ type: 'order.paid', data: { order: { id: 'ord_inexistente' } } })

    expect(createNotification).not.toHaveBeenCalled()
  })

  it('order.payment_failed nao notifica (so PAID notifica)', async () => {
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 })
    await handleWebhook({ type: 'order.payment_failed', data: { order: { id: 'ord_1' } } })
    expect(createNotification).not.toHaveBeenCalled()
  })

  it('order.payment_failed -> FAILED', async () => {
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 })
    await handleWebhook({ type: 'order.payment_failed', data: { order: { id: 'ord_1' } } })
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { pagarmeOrderId: 'ord_1' },
      data: { paymentStatus: 'FAILED' },
    })
  })

  it('charge.refunded -> REFUNDED', async () => {
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 })
    await handleWebhook({ type: 'charge.refunded', data: { order: { id: 'ord_1' } } })
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { pagarmeOrderId: 'ord_1' },
      data: { paymentStatus: 'REFUNDED' },
    })
  })

  it('chargeback.received -> CHARGEDBACK', async () => {
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 })
    await handleWebhook({ type: 'chargeback.received', data: { order: { id: 'ord_1' } } })
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { pagarmeOrderId: 'ord_1' },
      data: { paymentStatus: 'CHARGEDBACK' },
    })
  })

  it('ignora charge.chargedback (deprecado)', async () => {
    await handleWebhook({ type: 'charge.chargedback', data: { order: { id: 'ord_1' } } })
    expect(prisma.order.updateMany).not.toHaveBeenCalled()
  })

  it('recipient.updated -> atualiza recipientStatus da Store', async () => {
    vi.mocked(prisma.store.updateMany).mockResolvedValue({ count: 1 })
    await handleWebhook({ type: 'recipient.updated', data: { recipient: { id: 'rp_1' }, status: 'active' } })
    expect(prisma.store.updateMany).toHaveBeenCalledWith({
      where: { pagarmeRecipientId: 'rp_1' },
      data: { recipientStatus: 'active' },
    })
  })

  it('idempotente: reaplicar o mesmo evento nao lanca erro e mantem o mesmo estado', async () => {
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 })
    const event = { type: 'order.paid', data: { order: { id: 'ord_1' } } } as const
    await handleWebhook(event)
    await handleWebhook(event)
    expect(prisma.order.updateMany).toHaveBeenCalledTimes(2)
    expect(prisma.order.updateMany).toHaveBeenNthCalledWith(1, {
      where: { pagarmeOrderId: 'ord_1' },
      data: { paymentStatus: 'PAID' },
    })
    expect(prisma.order.updateMany).toHaveBeenNthCalledWith(2, {
      where: { pagarmeOrderId: 'ord_1' },
      data: { paymentStatus: 'PAID' },
    })
  })

  it('ignora evento sem order id', async () => {
    await handleWebhook({ type: 'order.paid', data: {} })
    expect(prisma.order.updateMany).not.toHaveBeenCalled()
  })
})
