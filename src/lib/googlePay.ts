/**
 * Integração com o Google Pay API for Web (pay.js) para o checkout com
 * Google Pay via Pagar.me. O SDK do Google é carregado dinamicamente em
 * runtime (`<script>`) — NUNCA importado estaticamente — para não pesar no
 * bundle da aplicação (orçamento apertado, ver check:bundle).
 *
 * O Pagar.me faz o DECRYPT do token no backend deles; este módulo nunca
 * inspeciona nem manipula o conteúdo do token — só faz `JSON.parse` do
 * `paymentMethodData.tokenizationData.token` (uma string JSON) e repassa o
 * objeto adiante, tal como recebido.
 */

const SCRIPT_URL = 'https://pay.google.com/gp/p/js/pay.js'
const ALLOWED_CARD_NETWORKS = ['VISA', 'MASTERCARD']
const ALLOWED_AUTH_METHODS = ['PAN_ONLY', 'CRYPTOGRAM_3DS']

export class GooglePayError extends Error {}

/** Shape mínimo do token que sai de `paymentMethodData.tokenizationData.token` (após `JSON.parse`). */
export interface GooglePayToken {
  protocolVersion: string
  signature: string
  signedMessage: string
  /** Só aparece no formato ECv2 com signing key intermediária — repassado sem inspecionar o conteúdo. */
  intermediateSigningKey?: unknown
}

export interface GooglePayResult {
  token: GooglePayToken
  /** Pedido via `emailRequired: true` no PaymentDataRequest — este componente não recebe o e-mail do comprador por prop. */
  email: string | null
  /** Pedido via `billingAddressRequired: true` — usado como `customer.name` no POST /orders/:id/pay. */
  billingName: string | null
}

export interface GooglePayTokenizationConfig {
  /** Id da conta Pagar.me — vira `parameters.gatewayMerchantId` no request e `merchant_identifier` no servidor. */
  gatewayMerchantId: string
  /** 'TEST' ou 'PRODUCTION' — controla o SDK do Google, não a Pagar.me. */
  environment: string
}

export interface GooglePayPaymentRequest extends GooglePayTokenizationConfig {
  totalCents: number
  merchantName: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleNamespace = any

let scriptLoadPromise: Promise<void> | null = null
let clientsByEnvironment = new Map<string, GoogleNamespace>()

const windowGoogle = (): GoogleNamespace | undefined =>
  typeof window !== 'undefined' ? (window as unknown as { google?: GoogleNamespace }).google : undefined

/**
 * Carrega `pay.js` uma única vez — idempotente mesmo que o componente que o
 * usa remonte (ex.: navegação para trás/para frente no checkout). Chamadas
 * concorrentes compartilham a mesma promise em voo.
 */
export const loadGooglePayScript = (): Promise<void> => {
  if (typeof document === 'undefined') return Promise.reject(new GooglePayError('Ambiente sem document.'))
  if (windowGoogle()) return Promise.resolve()
  if (scriptLoadPromise) return scriptLoadPromise

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`)
    if (existing) {
      if (windowGoogle()) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new GooglePayError('Falha ao carregar o Google Pay.')), {
        once: true,
      })
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new GooglePayError('Falha ao carregar o Google Pay.'))
    document.head.appendChild(script)
  }).catch((err: unknown) => {
    // Falha permite tentar de novo na próxima chamada (rede instável etc.).
    scriptLoadPromise = null
    throw err
  })

  return scriptLoadPromise
}

/** Só para testes — zera os singletons (script "carregado", clients em cache) entre casos. */
export const __resetGooglePayForTests = (): void => {
  scriptLoadPromise = null
  clientsByEnvironment = new Map()
}

const getPaymentsClient = (environment: string): GoogleNamespace => {
  const google = windowGoogle()
  if (!google) throw new GooglePayError('SDK do Google Pay não carregado.')
  const cached = clientsByEnvironment.get(environment)
  if (cached) return cached
  const client = new google.payments.api.PaymentsClient({ environment })
  clientsByEnvironment.set(environment, client)
  return client
}

const buildBaseRequest = () => ({ apiVersion: 2, apiVersionMinor: 0 })

/** allowedCardNetworks fixo em VISA/MASTERCARD — únicas bandeiras testadas contra o sandbox Pagar.me nesta fase. */
const buildCardPaymentMethod = (gatewayMerchantId: string) => ({
  type: 'CARD',
  parameters: {
    allowedAuthMethods: ALLOWED_AUTH_METHODS,
    allowedCardNetworks: ALLOWED_CARD_NETWORKS,
    billingAddressRequired: true,
    billingAddressParameters: { format: 'FULL' },
  },
  tokenizationSpecification: {
    type: 'PAYMENT_GATEWAY',
    parameters: { gateway: 'pagarme', gatewayMerchantId },
  },
})

/**
 * `isReadyToPay` — decide se o botão aparece. Qualquer falha (SDK não
 * carrega, ambiente sem suporte, etc.) vira `false`: o comprador cai no
 * formulário de cartão normal, a tela nunca quebra por causa do Google Pay.
 */
export const isGooglePayReady = async (config: GooglePayTokenizationConfig): Promise<boolean> => {
  try {
    await loadGooglePayScript()
    const client = getPaymentsClient(config.environment)
    const response = await client.isReadyToPay({
      ...buildBaseRequest(),
      allowedPaymentMethods: [buildCardPaymentMethod(config.gatewayMerchantId)],
    })
    return Boolean(response?.result)
  } catch {
    return false
  }
}

/**
 * Monta o `PaymentDataRequest`. Pede e-mail e nome de cobrança ao próprio
 * Google Pay (`emailRequired`/`billingAddressRequired`) — este componente
 * não recebe o nome/e-mail do comprador por prop, então usa o que o
 * comprador já confirmou na folha do Google Pay.
 */
export const buildPaymentDataRequest = (input: GooglePayPaymentRequest) => ({
  ...buildBaseRequest(),
  emailRequired: true,
  allowedPaymentMethods: [buildCardPaymentMethod(input.gatewayMerchantId)],
  merchantInfo: {
    merchantName: input.merchantName,
    ...(input.environment === 'PRODUCTION' ? { merchantId: input.gatewayMerchantId } : {}),
  },
  transactionInfo: {
    totalPriceStatus: 'FINAL',
    totalPrice: (input.totalCents / 100).toFixed(2),
    currencyCode: 'BRL',
    countryCode: 'BR',
  },
})

/**
 * Abre a folha de pagamento do Google Pay (`loadPaymentData`) e devolve o
 * token (já com `JSON.parse` feito) + e-mail/nome informados pelo
 * comprador. Nunca retorna/loga número de cartão — o Google Pay não expõe
 * isso para o site, só o token opaco.
 */
export const requestGooglePayment = async (input: GooglePayPaymentRequest): Promise<GooglePayResult> => {
  await loadGooglePayScript()
  const client = getPaymentsClient(input.environment)
  const request = buildPaymentDataRequest(input)

  let paymentData: GoogleNamespace
  try {
    paymentData = await client.loadPaymentData(request)
  } catch (err) {
    const canceled = (err as { statusCode?: string } | undefined)?.statusCode === 'CANCELED'
    throw new GooglePayError(
      canceled ? 'Pagamento cancelado.' : 'Não foi possível concluir o pagamento com Google Pay.',
    )
  }

  const rawToken: unknown = paymentData?.paymentMethodData?.tokenizationData?.token
  if (typeof rawToken !== 'string') {
    throw new GooglePayError('Resposta inesperada do Google Pay.')
  }

  let token: GooglePayToken
  try {
    token = JSON.parse(rawToken) as GooglePayToken
  } catch {
    throw new GooglePayError('Token do Google Pay inválido.')
  }

  return {
    token,
    email: (paymentData?.email as string | undefined) ?? null,
    billingName: (paymentData?.paymentMethodData?.info?.billingAddress?.name as string | undefined) ?? null,
  }
}
