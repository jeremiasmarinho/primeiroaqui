import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetGooglePayForTests,
  GooglePayError,
  buildPaymentDataRequest,
  isGooglePayReady,
  loadGooglePayScript,
  requestGooglePayment,
} from './googlePay'

/**
 * O SDK real (`pay.js`) não roda em jsdom — os testes simulam o objeto
 * `window.google` que o script normalmente injeta, e verificam que este
 * módulo (a) carrega o script uma única vez, (b) monta o request no shape
 * esperado pelo Pagar.me (gateway 'pagarme'), e (c) nunca deixa o número de
 * cartão vazar — só lida com o token opaco.
 */
describe('googlePay', () => {
  const config = { gatewayMerchantId: 'acc_123', environment: 'TEST' }

  beforeEach(() => {
    __resetGooglePayForTests()
    document.head.querySelectorAll('script').forEach((el) => el.remove())
    delete (window as unknown as { google?: unknown }).google
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** Injeta um `window.google` fake assim que o `<script>` "carrega" — simula o pay.js real. */
  const stubGoogleScript = (client: { isReadyToPay: ReturnType<typeof vi.fn>; loadPaymentData: ReturnType<typeof vi.fn> }) => {
    const PaymentsClient = vi.fn(function PaymentsClientMock() {
      return client
    })
    let triggered = false
    const originalAppendChild = document.head.appendChild.bind(document.head)
    vi.spyOn(document.head, 'appendChild').mockImplementation(((node: Node) => {
      const result = originalAppendChild(node)
      if (!triggered && node instanceof HTMLScriptElement) {
        triggered = true
        ;(window as unknown as { google: unknown }).google = { payments: { api: { PaymentsClient } } }
        node.onload?.(new Event('load'))
      }
      return result
    }) as typeof document.head.appendChild)
    return PaymentsClient
  }

  describe('loadGooglePayScript', () => {
    it('injeta o script do Google Pay uma única vez, mesmo com chamadas concorrentes', async () => {
      stubGoogleScript({ isReadyToPay: vi.fn(), loadPaymentData: vi.fn() })
      await Promise.all([loadGooglePayScript(), loadGooglePayScript(), loadGooglePayScript()])
      expect(document.head.querySelectorAll(`script[src="https://pay.google.com/gp/p/js/pay.js"]`)).toHaveLength(1)
    })

    it('não reinjeta o script se `window.google` já existe (ex.: componente remontou)', async () => {
      ;(window as unknown as { google: unknown }).google = { payments: { api: { PaymentsClient: vi.fn() } } }
      await loadGooglePayScript()
      expect(document.head.querySelectorAll('script')).toHaveLength(0)
    })
  })

  describe('isGooglePayReady', () => {
    it('true quando o SDK confirma isReadyToPay', async () => {
      stubGoogleScript({ isReadyToPay: vi.fn().mockResolvedValue({ result: true }), loadPaymentData: vi.fn() })
      await expect(isGooglePayReady(config)).resolves.toBe(true)
    })

    it('false quando o SDK nega (não deve quebrar — cai no formulário de cartão)', async () => {
      stubGoogleScript({ isReadyToPay: vi.fn().mockResolvedValue({ result: false }), loadPaymentData: vi.fn() })
      await expect(isGooglePayReady(config)).resolves.toBe(false)
    })

    it('false (nunca lança) se o SDK falhar ao carregar', async () => {
      vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
        if (node instanceof HTMLScriptElement) node.onerror?.(new Event('error'))
        return node
      })
      await expect(isGooglePayReady(config)).resolves.toBe(false)
    })
  })

  describe('buildPaymentDataRequest', () => {
    it('usa gateway "pagarme" e o gatewayMerchantId da conta na tokenizationSpecification', () => {
      const request = buildPaymentDataRequest({ ...config, totalCents: 19990, merchantName: 'Primeiro Aqui' })
      const method = request.allowedPaymentMethods[0]!
      expect(method.tokenizationSpecification).toEqual({
        type: 'PAYMENT_GATEWAY',
        parameters: { gateway: 'pagarme', gatewayMerchantId: 'acc_123' },
      })
      expect(method.parameters.allowedCardNetworks).toEqual(['VISA', 'MASTERCARD'])
    })

    it('totalPrice em reais (2 casas), a partir do total em centavos', () => {
      const request = buildPaymentDataRequest({ ...config, totalCents: 19990, merchantName: 'Primeiro Aqui' })
      expect(request.transactionInfo.totalPrice).toBe('199.90')
      expect(request.transactionInfo.currencyCode).toBe('BRL')
    })

    it('pede email e nome de cobrança — este módulo não recebe buyer name/email por parâmetro', () => {
      const request = buildPaymentDataRequest({ ...config, totalCents: 100, merchantName: 'Primeiro Aqui' })
      expect(request.emailRequired).toBe(true)
      expect(request.allowedPaymentMethods[0]!.parameters.billingAddressRequired).toBe(true)
    })
  })

  describe('requestGooglePayment', () => {
    const paymentRequestInput = { ...config, totalCents: 19990, merchantName: 'Primeiro Aqui' }

    it('devolve o token (já parseado), email e nome de cobrança do paymentData', async () => {
      const rawToken = JSON.stringify({
        protocolVersion: 'ECv2',
        signature: 'sig',
        signedMessage: '{"encryptedMessage":"..."}',
      })
      stubGoogleScript({
        isReadyToPay: vi.fn(),
        loadPaymentData: vi.fn().mockResolvedValue({
          email: 'comprador@example.com',
          paymentMethodData: {
            tokenizationData: { token: rawToken },
            info: { billingAddress: { name: 'Ana Paula' } },
          },
        }),
      })

      const result = await requestGooglePayment(paymentRequestInput)
      expect(result.token).toEqual({ protocolVersion: 'ECv2', signature: 'sig', signedMessage: '{"encryptedMessage":"..."}' })
      expect(result.email).toBe('comprador@example.com')
      expect(result.billingName).toBe('Ana Paula')
    })

    it('nunca expõe número de cartão — só repassa o token opaco tal como veio', async () => {
      const rawToken = JSON.stringify({ protocolVersion: 'ECv2', signature: 'sig', signedMessage: 'msg' })
      stubGoogleScript({
        isReadyToPay: vi.fn(),
        loadPaymentData: vi.fn().mockResolvedValue({
          email: 'a@example.com',
          paymentMethodData: { tokenizationData: { token: rawToken }, info: { billingAddress: { name: 'Ana' } } },
        }),
      })
      const result = await requestGooglePayment(paymentRequestInput)
      expect(JSON.stringify(result)).not.toMatch(/\d{12,}/)
    })

    it('GooglePayError com mensagem de cancelamento quando o comprador fecha a folha', async () => {
      stubGoogleScript({
        isReadyToPay: vi.fn(),
        loadPaymentData: vi.fn().mockRejectedValue({ statusCode: 'CANCELED' }),
      })
      await expect(requestGooglePayment(paymentRequestInput)).rejects.toThrow(GooglePayError)
      await expect(requestGooglePayment(paymentRequestInput)).rejects.toThrow(/cancelado/i)
    })

    it('GooglePayError em qualquer outra falha do loadPaymentData', async () => {
      stubGoogleScript({ isReadyToPay: vi.fn(), loadPaymentData: vi.fn().mockRejectedValue(new Error('boom')) })
      await expect(requestGooglePayment(paymentRequestInput)).rejects.toThrow(GooglePayError)
    })

    it('GooglePayError se o token vier ausente/malformado', async () => {
      stubGoogleScript({
        isReadyToPay: vi.fn(),
        loadPaymentData: vi.fn().mockResolvedValue({ paymentMethodData: { tokenizationData: {} } }),
      })
      await expect(requestGooglePayment(paymentRequestInput)).rejects.toThrow(GooglePayError)
    })
  })
})
