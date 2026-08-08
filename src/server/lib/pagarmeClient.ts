/**
 * Cliente HTTP fino para a Pagar.me Core API v5 (sandbox nesta fase).
 * https://api.pagar.me/core/v5 — autenticacao HTTP Basic com a secret key
 * (`base64("sk_...:")`, sem senha).
 *
 * Leitura de env e sempre LAZY (dentro das funcoes, nunca no top-level do
 * modulo): o app precisa subir mesmo sem PAGARME_SECRET_KEY configurada
 * (ex.: ambiente sem pagamento habilitado ainda). O erro so aparece na hora
 * em que uma rota efetivamente tenta falar com o Pagar.me.
 */

const BASE_URL = 'https://api.pagar.me/core/v5'

export class PagarmeConfigError extends Error {}

/** Erro retornado pela API do Pagar.me (4xx/5xx) — preserva status e corpo para quem for tratar. */
export class PagarmeApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message)
    this.name = 'PagarmeApiError'
  }
}

/** Le PAGARME_SECRET_KEY do env. Lanca PagarmeConfigError (nao lanca no import) se ausente. */
export const getPagarmeSecretKey = (): string => {
  const key = process.env.PAGARME_SECRET_KEY
  if (!key) {
    throw new PagarmeConfigError('PAGARME_SECRET_KEY ausente — configure no .env.local (sandbox) ou no ambiente')
  }
  return key
}

/** Id do recipient da PLATAFORMA no Pagar.me (recebe o split da taxa). Lazy, mesmo padrao acima. */
export const getPlatformRecipientId = (): string => {
  const id = process.env.PAGARME_PLATFORM_RECIPIENT_ID
  if (!id) {
    throw new PagarmeConfigError('PAGARME_PLATFORM_RECIPIENT_ID ausente — configure no .env.local (sandbox) ou no ambiente')
  }
  return id
}

/** Checagem NAO-lancante de `getPlatformRecipientId` — usada para decidir se o split entra ou nao no payload da order. */
export const hasPlatformRecipientId = (): boolean => Boolean(process.env.PAGARME_PLATFORM_RECIPIENT_ID)

/**
 * Public key do Pagar.me (`pk_...`) — SEGURA para o front, usada na
 * tokenizacao client-side (POST /core/v5/tokens?appId=pk_...). Exposta via
 * GET /api/payments/config para o front nunca precisar de env propria.
 */
export const getPagarmePublicKey = (): string => {
  const key = process.env.PAGARME_PUBLIC_KEY
  if (!key) {
    throw new PagarmeConfigError('PAGARME_PUBLIC_KEY ausente — configure no .env.local (sandbox) ou no ambiente')
  }
  return key
}

/**
 * Percentual da plataforma no split, LIQUIDO — decisao de negocio
 * (2026-08-07): a plataforma fica com 5% livre de taxas de processamento
 * (essas taxas ficam por conta da loja). Default 5, configuravel via
 * PLATFORM_FEE_PERCENT para permitir ajuste sem deploy de codigo.
 */
export const getPlatformFeePercent = (): number => {
  const raw = process.env.PLATFORM_FEE_PERCENT
  if (!raw) return 5
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new PagarmeConfigError(`PLATFORM_FEE_PERCENT invalido: ${raw}`)
  }
  return parsed
}

/**
 * Se true, pedidos so podem ser pagos quando a Store tiver
 * recipientStatus === 'active'. Default false (fase sandbox — nenhum
 * recipient real de loja ainda existe na maioria dos casos de teste).
 * Documentado: EM PRODUCAO isso deve ser true.
 */
export const requireActiveRecipient = (): boolean => {
  return process.env.PAGARME_REQUIRE_ACTIVE_RECIPIENT === 'true'
}

const authHeader = (): string => {
  const secretKey = getPagarmeSecretKey()
  return 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64')
}

/** Faz uma requisicao autenticada contra a Core API v5. Lanca PagarmeApiError em resposta nao-2xx. */
export const pagarmeRequest = async <T>(
  path: string,
  init: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown } = { method: 'GET' },
): Promise<T> => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: init.method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })

  const text = await res.text()
  const parsed: unknown = text ? JSON.parse(text) : undefined

  if (!res.ok) {
    throw new PagarmeApiError(`Pagar.me respondeu ${res.status} em ${path}`, res.status, parsed)
  }
  return parsed as T
}

// ---- Tipos minimos dos payloads/respostas usados por paymentService.ts ----

export type PagarmeSplitOptions = {
  liable: boolean
  charge_processing_fee: boolean
  charge_remainder_fee: boolean
}

export type PagarmeSplitRule = {
  amount: number
  type: 'percentage' | 'flat'
  recipient_id: string
  options: PagarmeSplitOptions
}

export type PagarmeBankAccount = {
  holder_name: string
  holder_type: 'individual' | 'company'
  holder_document: string
  bank: string
  branch_number: string
  branch_check_digit?: string
  account_number: string
  account_check_digit: string
  type: 'checking' | 'savings'
}

export type PagarmeRegisterInformationPF = {
  type: 'individual'
  document: string
  name: string
  email: string
  birthdate: string
  monthly_income: number
  professional_occupation: string
  phone_numbers?: Array<{ ddd: string; number: string; type: string }>
}

export type PagarmeRegisterInformationPJ = {
  type: 'corporation'
  document: string
  company_name: string
  trading_name: string
  email: string
  annual_revenue: number
  phone_numbers?: Array<{ ddd: string; number: string; type: string }>
}

export type PagarmeCreateRecipientPayload = {
  register_information: PagarmeRegisterInformationPF | PagarmeRegisterInformationPJ
  default_bank_account: PagarmeBankAccount
}

export type PagarmeRecipientResponse = {
  id: string
  status: string
  kyc_details?: { status: string }
}

/**
 * `code` e obrigatorio — confirmado em sandbox real (2026-08-07): sem ele o
 * charge falha com "The item Code is required." Usamos o productId como
 * code (identificador natural e unico do item dentro do pedido).
 */
export type PagarmeOrderItem = {
  amount: number
  description: string
  quantity: number
  code: string
}

/** Telefone no formato exigido pelo Pagar.me (DDI/DDD/numero separados). */
export type PagarmePhone = {
  country_code: string
  area_code: string
  number: string
}

export type PagarmeCustomer = {
  name: string
  email: string
  document: string
  document_type?: 'CPF' | 'CNPJ'
  type: 'individual' | 'company'
  /**
   * Obrigatorio na pratica — confirmado em sandbox real (2026-08-07): sem
   * `phones.mobile_phone`, tanto Pix ("At least one customer phone is
   * required") quanto cartao (antifraude) rejeitam o pagamento.
   */
  phones?: { mobile_phone?: PagarmePhone }
}

/**
 * Endereco de cobranca do cartao. Confirmado em sandbox real (2026-08-07):
 * sem ele o charge de cartao falha na validacao do adquirente
 * ("billing | \"value\" is required"). Vai em
 * `credit_card.card.billing_address` (NAO direto em `credit_card` — testado
 * e corrigido: a doc mostra esse campo dentro do objeto `card` de numero
 * cru, mas o mesmo aninhamento vale quando so `card_token` e enviado, com
 * `card` contendo so `billing_address`).
 */
export type PagarmeBillingAddress = {
  line_1: string
  line_2?: string
  zip_code: string
  city: string
  state: string
  country: string
}

export type PagarmePixPayment = {
  payment_method: 'pix'
  pix: { expires_in: number }
  /** Ausente = 100% pra conta master. Ver split condicional em paymentService.ts. */
  split?: PagarmeSplitRule[]
}

/**
 * Payload de tokenizacao alternativa (wallet) do cartao — Google Pay. O
 * Pagar.me faz o DECRYPT do token no backend deles; nos so repassamos o
 * objeto tal como o SDK do Google devolveu (campos version/signature/
 * intermediate_signing_key/signed_message em snake_case + o
 * merchant_identifier da nossa conta Pagar.me). Ver
 * src/server/lib/paymentService.ts `buildGooglePayPayload`.
 */
export type PagarmeGooglePayPayload = {
  type: 'google_pay'
  google_pay: {
    version: string
    signature: string
    /** Shape interno controlado pelo Google (signedKey/signatures) — repassado sem alteracao. */
    intermediate_signing_key?: unknown
    signed_message: string
    merchant_identifier: string
  }
}

export type PagarmeCreditCardPayment = {
  payment_method: 'credit_card'
  credit_card: {
    /** Ausente no fluxo Google Pay — usa `payload` no lugar do token classico. */
    card_token?: string
    installments?: number
    /** `billing_address` some com card_token — ver PagarmeBillingAddress acima para o porque. */
    card?: { billing_address: PagarmeBillingAddress }
    /** Presente SOMENTE no fluxo Google Pay — ver PagarmeGooglePayPayload acima. */
    payload?: PagarmeGooglePayPayload
  }
  /** Ausente = 100% pra conta master. Ver split condicional em paymentService.ts. */
  split?: PagarmeSplitRule[]
}

export type PagarmeCreateOrderPayload = {
  items: PagarmeOrderItem[]
  customer: PagarmeCustomer
  payments: Array<PagarmePixPayment | PagarmeCreditCardPayment>
}

export type PagarmeCharge = {
  id: string
  status: string
  last_transaction?: {
    qr_code?: string
    qr_code_url?: string
    expires_at?: string
  }
}

export type PagarmeOrderResponse = {
  id: string
  status: string
  charges?: PagarmeCharge[]
}
