import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getPagarmeSecretKey,
  getPlatformRecipientId,
  getPlatformFeePercent,
  hasPlatformRecipientId,
  requireActiveRecipient,
  pagarmeRequest,
  PagarmeConfigError,
  PagarmeApiError,
} from './pagarmeClient'

describe('pagarmeClient — leitura lazy de env', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('getPagarmeSecretKey lanca PagarmeConfigError se ausente (nao no import)', () => {
    delete process.env.PAGARME_SECRET_KEY
    expect(() => getPagarmeSecretKey()).toThrow(PagarmeConfigError)
  })

  it('getPagarmeSecretKey retorna a chave quando presente', () => {
    process.env.PAGARME_SECRET_KEY = 'sk_test_123'
    expect(getPagarmeSecretKey()).toBe('sk_test_123')
  })

  it('getPlatformRecipientId lanca PagarmeConfigError se ausente', () => {
    delete process.env.PAGARME_PLATFORM_RECIPIENT_ID
    expect(() => getPlatformRecipientId()).toThrow(PagarmeConfigError)
  })

  it('hasPlatformRecipientId nao lanca — false se ausente, true se presente', () => {
    delete process.env.PAGARME_PLATFORM_RECIPIENT_ID
    expect(hasPlatformRecipientId()).toBe(false)
    process.env.PAGARME_PLATFORM_RECIPIENT_ID = 'rp_platform'
    expect(hasPlatformRecipientId()).toBe(true)
  })

  it('getPlatformFeePercent default e 5 (decisao de negocio 2026-08-07)', () => {
    delete process.env.PLATFORM_FEE_PERCENT
    expect(getPlatformFeePercent()).toBe(5)
  })

  it('getPlatformFeePercent le override valido do env', () => {
    process.env.PLATFORM_FEE_PERCENT = '12.5'
    expect(getPlatformFeePercent()).toBe(12.5)
  })

  it('getPlatformFeePercent rejeita valor invalido', () => {
    process.env.PLATFORM_FEE_PERCENT = 'abc'
    expect(() => getPlatformFeePercent()).toThrow(PagarmeConfigError)
  })

  it('requireActiveRecipient default e false', () => {
    delete process.env.PAGARME_REQUIRE_ACTIVE_RECIPIENT
    expect(requireActiveRecipient()).toBe(false)
  })

  it('requireActiveRecipient le "true" do env', () => {
    process.env.PAGARME_REQUIRE_ACTIVE_RECIPIENT = 'true'
    expect(requireActiveRecipient()).toBe(true)
  })
})

describe('pagarmeRequest', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.PAGARME_SECRET_KEY = 'sk_test_abc'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  it('envia Authorization Basic com base64("sk:...") e retorna o JSON parseado', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'ord_1' }), { status: 200 }),
    )

    const result = await pagarmeRequest<{ id: string }>('/orders', { method: 'POST', body: { foo: 'bar' } })

    expect(result).toEqual({ id: 'ord_1' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.pagar.me/core/v5/orders')
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Basic ' + Buffer.from('sk_test_abc:').toString('base64'))
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify({ foo: 'bar' }))
  })

  it('lanca PagarmeApiError com status e body quando a resposta nao e 2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'invalid' }), { status: 422 }),
    )

    await expect(pagarmeRequest('/orders', { method: 'POST', body: {} })).rejects.toMatchObject({
      name: 'PagarmeApiError',
      status: 422,
      body: { message: 'invalid' },
    })
  })

  it('propaga PagarmeConfigError se a secret key nao estiver configurada', async () => {
    delete process.env.PAGARME_SECRET_KEY
    await expect(pagarmeRequest('/orders', { method: 'GET' })).rejects.toBeInstanceOf(PagarmeConfigError)
  })
})
