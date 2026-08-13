import { prisma } from './prismaClient'
import { createNotification } from './notifications'
import { formatCents } from '../../lib/money'
import {
  pagarmeRequest,
  getPlatformRecipientId,
  getPlatformFeePercent,
  hasPlatformRecipientId,
  PagarmeApiError,
  type PagarmeBankAccount,
  type PagarmeCreateRecipientPayload,
  type PagarmeRecipientResponse,
  type PagarmeCreateOrderPayload,
  type PagarmeOrderResponse,
  type PagarmeSplitRule,
  type PagarmeGooglePayPayload,
} from './pagarmeClient'
import type { Order, Store } from '@prisma/client'

export class PaymentValidationError extends Error {}

/**
 * Erro de dominio para quando a conta do Pagar.me nao tem a funcao
 * marketplace/split habilitada. Confirmado em sandbox real (2026-08-07):
 * POST /recipients responde 412 com mensagem "This company is not allowed
 * to create a recipient" — a Pagar.me exige liberacao manual (gate de
 * afiliacao) antes de qualquer conta poder criar recipients/usar split.
 * Ate essa liberacao chegar, `createRecipientForStore` nao pode ser usada
 * de verdade; `createPaymentOrder` degrada para 100% na conta master (ver
 * comentario em `buildSplitRules`/`createPaymentOrder`).
 */
export class MarketplaceNotEnabledError extends Error {
  code = 'MARKETPLACE_NOT_ENABLED' as const

  constructor(cause: PagarmeApiError) {
    super('Conta Pagar.me sem a funcao marketplace/split habilitada (aguardando liberacao do suporte)')
    this.name = 'MarketplaceNotEnabledError'
    this.cause = cause
  }
}

/**
 * Reconhece o 412 "action not allowed" do Pagar.me para criacao de
 * recipient e o traduz num erro de dominio claro. Qualquer outro erro da
 * API passa adiante sem alteracao.
 */
const isMarketplaceNotEnabledError = (err: unknown): err is PagarmeApiError => {
  if (!(err instanceof PagarmeApiError)) return false
  if (err.status !== 412) return false
  const body = err.body as { message?: string; type?: string } | undefined
  const message = body?.message ?? ''
  return /not allowed to create a recipient/i.test(message) || body?.type === 'action_forbidden'
}

// -------------------- Recipients (loja) --------------------

/** Dados minimos exigidos do lojista para virar recebedor no Pagar.me. Pessoa Fisica ou Juridica. */
export type StoreRecipientInputPF = {
  personType: 'individual'
  document: string
  name: string
  email: string
  birthdate: string
  monthlyIncome: number
  professionalOccupation: string
  bankAccount: PagarmeBankAccount
}

export type StoreRecipientInputPJ = {
  personType: 'company'
  document: string
  companyName: string
  tradingName: string
  email: string
  annualRevenue: number
  bankAccount: PagarmeBankAccount
}

export type StoreRecipientInput = StoreRecipientInputPF | StoreRecipientInputPJ

/** Monta o payload de POST /recipients (PF ou PJ) a partir dos dados bancarios/cadastrais do lojista. */
export const buildRecipientPayload = (input: StoreRecipientInput): PagarmeCreateRecipientPayload => {
  if (input.personType === 'individual') {
    return {
      register_information: {
        type: 'individual',
        document: input.document,
        name: input.name,
        email: input.email,
        birthdate: input.birthdate,
        monthly_income: input.monthlyIncome,
        professional_occupation: input.professionalOccupation,
      },
      default_bank_account: input.bankAccount,
    }
  }
  return {
    register_information: {
      type: 'corporation',
      document: input.document,
      company_name: input.companyName,
      trading_name: input.tradingName,
      email: input.email,
      annual_revenue: input.annualRevenue,
    },
    default_bank_account: input.bankAccount,
  }
}

/**
 * Cria o recipient (recebedor) da loja no Pagar.me e persiste
 * pagarmeRecipientId/recipientStatus na Store. O status inicial normalmente
 * volta como algo como "pending"/"registration" — a mudanca para "active"
 * chega depois via webhook `recipient.updated` (ver handleWebhook).
 */
export const createRecipientForStore = async (store: Store, input: StoreRecipientInput): Promise<Store> => {
  const payload = buildRecipientPayload(input)

  let response: PagarmeRecipientResponse
  try {
    response = await pagarmeRequest<PagarmeRecipientResponse>('/recipients', {
      method: 'POST',
      body: payload,
    })
  } catch (err) {
    if (isMarketplaceNotEnabledError(err)) {
      throw new MarketplaceNotEnabledError(err)
    }
    throw err
  }

  return prisma.store.update({
    where: { id: store.id },
    data: {
      pagarmeRecipientId: response.id,
      recipientStatus: response.status,
    },
  })
}

// -------------------- Payment orders (pedido) --------------------

/**
 * Regra de split — decisao de negocio (2026-08-07):
 * a plataforma fica com PLATFORM_FEE_PERCENT% LIQUIDO (5% por default); as
 * taxas de processamento e o residual de arredondamento (charge_processing_fee
 * / charge_remainder_fee) ficam por conta da LOJA, nao da plataforma.
 * O risco de chargeback (liable) permanece com a PLATAFORMA — decisao de
 * arquitetura anterior para proteger o lojista pequeno; isso e risco, nao
 * taxa, entao continua separado da regra de taxas de processamento acima.
 *
 * ATENCAO: assumimos que a API do Pagar.me aceita `liable: true` num
 * recipient e `charge_processing_fee: true` em OUTRO recipient da mesma
 * split rule (plataforma liable, loja paga a taxa). Isso ainda NAO foi
 * validado contra o sandbox real com split de verdade — a conta de teste
 * atual nao tem a funcao marketplace/split habilitada (ver
 * MarketplaceNotEnabledError acima; 412 "not allowed to create a
 * recipient" ao tentar POST /recipients). Enquanto essa liberacao nao
 * chega, esta funcao so e exercitada pelo smoke-test de nivel (b) em
 * paymentService.smoke.test.ts, que so roda com
 * PAGARME_PLATFORM_RECIPIENT_ID + um recipient de loja de teste validos.
 */
export const buildSplitRules = (storeRecipientId: string): PagarmeSplitRule[] => {
  const platformFeePercent = getPlatformFeePercent()
  const storePercent = 100 - platformFeePercent

  return [
    {
      amount: storePercent,
      type: 'percentage',
      recipient_id: storeRecipientId,
      options: {
        liable: false,
        charge_processing_fee: true,
        charge_remainder_fee: true,
      },
    },
    {
      amount: platformFeePercent,
      type: 'percentage',
      recipient_id: getPlatformRecipientId(),
      options: {
        liable: true,
        charge_processing_fee: false,
        charge_remainder_fee: false,
      },
    },
  ]
}

/** Calcula em centavos quanto vai para a plataforma e quanto vai para a loja, dado o total do pedido. */
export const calculateSplitCents = (totalCents: number): { platformFeeCents: number; storeAmountCents: number } => {
  const platformFeePercent = getPlatformFeePercent()
  const platformFeeCents = Math.round((totalCents * platformFeePercent) / 100)
  return { platformFeeCents, storeAmountCents: totalCents - platformFeeCents }
}

export type OrderWithItemsAndStore = Order & {
  store: Store
  items: Array<{ productId: string; quantity: number; unitPriceCents: number }>
}

/**
 * `phone` confirmado obrigatorio na pratica pelo sandbox real (2026-08-07)
 * — ver comentario em `PagarmeCustomer.phones` em pagarmeClient.ts. Opcional
 * no tipo porque a Fase 2 (checkout) ainda vai construir a coleta desse
 * dado; sem ele o pagamento e tentado mesmo assim e falha do lado do
 * Pagar.me com uma mensagem clara, em vez de bloquear aqui.
 */
export type PaymentCustomerInput = {
  name: string
  email: string
  document: string
  documentType: 'CPF' | 'CNPJ'
  phone?: { countryCode: string; areaCode: string; number: string }
}

/**
 * Endereco de cobranca do cartao — ver PagarmeBillingAddress em
 * pagarmeClient.ts (confirmado obrigatorio na pratica pelo sandbox real).
 */
export type BillingAddressInput = {
  line1: string
  line2?: string
  zipCode: string
  city: string
  state: string
  country: string
}

/**
 * Shape minimo do token que o front devolve apos `google.payments.api.
 * PaymentsClient.loadPaymentData` (JSON.parse de
 * paymentMethodData.tokenizationData.token) — protocolVersion/signature/
 * signedMessage sao os campos exigidos pelo Pagar.me para decriptar;
 * intermediateSigningKey e opcional (so aparece com ECv2 + signing key
 * intermediaria) e e repassado como veio, sem inspecionar o conteudo.
 */
export type GooglePayTokenInput = {
  protocolVersion: string
  signature: string
  signedMessage: string
  intermediateSigningKey?: unknown
}

export type CreatePaymentOrderOptions =
  | { method: 'pix'; customer: PaymentCustomerInput }
  | {
      method: 'credit_card'
      customer: PaymentCustomerInput
      cardToken: string
      installments?: number
      billingAddress?: BillingAddressInput
    }
  | {
      method: 'google_pay'
      customer: PaymentCustomerInput
      googlePayToken: GooglePayTokenInput
      /** Id da conta Pagar.me usada como `gatewayMerchantId` no front e `merchant_identifier` aqui. */
      gatewayMerchantId: string
      installments?: number
      billingAddress?: BillingAddressInput
    }

/**
 * Monta `credit_card.payload` do fluxo Google Pay — o UNICO pedaco do
 * payload que muda em relacao ao cartao tokenizado classico (ver
 * `createPaymentOrder` abaixo). O Pagar.me faz o decrypt do token no
 * servidor deles; nos so repassamos os campos tal como o SDK do Google
 * devolveu, convertidos para snake_case.
 */
const buildGooglePayPayload = (
  options: Extract<CreatePaymentOrderOptions, { method: 'google_pay' }>,
): PagarmeGooglePayPayload => ({
  type: 'google_pay',
  google_pay: {
    version: options.googlePayToken.protocolVersion,
    signature: options.googlePayToken.signature,
    intermediate_signing_key: options.googlePayToken.intermediateSigningKey,
    signed_message: options.googlePayToken.signedMessage,
    merchant_identifier: options.gatewayMerchantId,
  },
})

const PIX_EXPIRES_IN_SECONDS = 30 * 60

/**
 * Monta e cria a order de pagamento no Pagar.me (Pix ou cartao tokenizado),
 * e persiste pagarmeOrderId + paymentStatus=PENDING +
 * platformFeeCents/storeAmountCents na Order local.
 *
 * SPLIT CONDICIONAL (2026-08-07): a conta Pagar.me do usuario ainda nao tem
 * a funcao marketplace/split liberada (gate de afiliacao — ver
 * MarketplaceNotEnabledError). Enquanto isso, se PAGARME_PLATFORM_RECIPIENT_ID
 * estiver ausente OU a loja nao tiver pagarmeRecipientId, a order e criada
 * SEM o campo `split` — 100% cai na conta master, que e a unica coisa que a
 * conta atual consegue fazer. platformFeeCents/storeAmountCents continuam
 * sendo calculados e persistidos nos dois casos: e o registro de auditoria
 * de quanto o split VAI mandar pra cada lado assim que a liberacao chegar e
 * o split for ligado de verdade — nao e dinheiro efetivamente separado
 * ainda quando o split esta desligado.
 *
 * NUNCA aceita numero de cartao cru — `cardToken` deve vir ja tokenizado
 * pelo front via POST https://api.pagar.me/core/v5/tokens?appId=pk_... (a
 * public key do Pagar.me, tokenizacao client-side). Isso e enforced na rota
 * (src/server/routes/payments.ts), nao aqui.
 *
 * CAMINHO DE CARTAO VALIDADO EM SANDBOX REAL (2026-08-07): order/charge
 * `status: "paid"` com token + `billingAddress` + `customer.phone`
 * preenchidos — ver src/server/lib/paymentService.smoke.test.ts. Pix e
 * split seguem gateados na conta (liberacao pendente do suporte Pagar.me).
 */
export const createPaymentOrder = async (
  order: OrderWithItemsAndStore,
  options: CreatePaymentOrderOptions,
): Promise<{ order: Order; pagarmeOrder: PagarmeOrderResponse }> => {
  const splitEnabled = Boolean(order.store.pagarmeRecipientId) && hasPlatformRecipientId()
  const split = splitEnabled ? buildSplitRules(order.store.pagarmeRecipientId!) : undefined
  const { platformFeeCents, storeAmountCents } = calculateSplitCents(order.totalCents)

  const customer = {
    name: options.customer.name,
    email: options.customer.email,
    document: options.customer.document,
    document_type: options.customer.documentType,
    type: (options.customer.documentType === 'CNPJ' ? 'company' : 'individual') as 'individual' | 'company',
    ...(options.customer.phone
      ? {
          phones: {
            mobile_phone: {
              country_code: options.customer.phone.countryCode,
              area_code: options.customer.phone.areaCode,
              number: options.customer.phone.number,
            },
          },
        }
      : {}),
  }

  // `code` obrigatorio (ver PagarmeOrderItem) — usamos o productId, unico
  // dentro do pedido, em vez de um indice sequencial sem significado.
  const items = order.items.map((item, index) => ({
    amount: item.unitPriceCents,
    description: `Item ${index + 1}`,
    quantity: item.quantity,
    code: item.productId,
  }))

  // credit_card.payload SO muda entre cartao classico e Google Pay — o
  // resto (items/customer/split/billing_address) e identico, ver
  // `buildGooglePayPayload` acima.
  const buildCreditCardBlock = (
    creditOptions: Extract<CreatePaymentOrderOptions, { method: 'credit_card' | 'google_pay' }>,
  ) => ({
    installments: creditOptions.installments ?? 1,
    ...(creditOptions.method === 'credit_card' ? { card_token: creditOptions.cardToken } : {}),
    ...(creditOptions.method === 'google_pay' ? { payload: buildGooglePayPayload(creditOptions) } : {}),
    ...(creditOptions.billingAddress
      ? {
          card: {
            billing_address: {
              line_1: creditOptions.billingAddress.line1,
              line_2: creditOptions.billingAddress.line2,
              zip_code: creditOptions.billingAddress.zipCode,
              city: creditOptions.billingAddress.city,
              state: creditOptions.billingAddress.state,
              country: creditOptions.billingAddress.country,
            },
          },
        }
      : {}),
  })

  const payload: PagarmeCreateOrderPayload =
    options.method === 'pix'
      ? {
          items,
          customer,
          payments: [{ payment_method: 'pix', pix: { expires_in: PIX_EXPIRES_IN_SECONDS }, ...(split ? { split } : {}) }],
        }
      : {
          items,
          customer,
          payments: [
            {
              payment_method: 'credit_card',
              credit_card: buildCreditCardBlock(options),
              ...(split ? { split } : {}),
            },
          ],
        }

  const pagarmeOrder = await pagarmeRequest<PagarmeOrderResponse>('/orders', { method: 'POST', body: payload })

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      pagarmeOrderId: pagarmeOrder.id,
      paymentStatus: 'PENDING',
      platformFeeCents,
      storeAmountCents,
    },
  })

  return { order: updated, pagarmeOrder }
}

// -------------------- Webhooks --------------------

/** Eventos tratados. `charge.chargedback` e propositalmente IGNORADO (deprecado pelo Pagar.me — usar chargeback.received). */
export type PagarmeWebhookEvent = {
  type: string
  data: {
    id?: string
    order?: { id?: string }
    recipient?: { id?: string }
    status?: string
    kyc_details?: { status?: string }
  }
}

const ORDER_EVENT_TO_STATUS: Record<string, string> = {
  'order.paid': 'PAID',
  'charge.paid': 'PAID',
  'order.payment_failed': 'FAILED',
  'charge.refunded': 'REFUNDED',
  'chargeback.received': 'CHARGEDBACK',
}

/**
 * Processa um webhook do Pagar.me. Idempotente: reaplicar o mesmo evento
 * (mesmo pagarmeOrderId + mesmo status-alvo) e um no-op seguro — nao ha
 * efeito colateral alem do proprio campo de status, entao setar o mesmo
 * valor de novo nao duplica nada. `charge.chargedback` (deprecado) e
 * ignorado silenciosamente; use `chargeback.received`.
 */
export const handleWebhook = async (event: PagarmeWebhookEvent): Promise<void> => {
  if (event.type === 'recipient.updated') {
    const recipientId = event.data.recipient?.id ?? event.data.id
    const status = event.data.status
    if (!recipientId || !status) return
    await prisma.store.updateMany({
      where: { pagarmeRecipientId: recipientId },
      data: { recipientStatus: status },
    })
    return
  }

  const nextStatus = ORDER_EVENT_TO_STATUS[event.type]
  if (!nextStatus) return // inclui charge.chargedback (deprecado) e eventos nao mapeados

  const pagarmeOrderId = event.data.order?.id ?? event.data.id
  if (!pagarmeOrderId) return

  // Le o pedido ANTES de atualizar para saber se essa e a PRIMEIRA vez que
  // ele vira PAID — reaplicar o mesmo webhook (idempotencia, ver comentario
  // da funcao) nao pode notificar o comprador de novo a cada replay.
  const before =
    nextStatus === 'PAID'
      ? await prisma.order.findFirst({
          where: { pagarmeOrderId },
          select: { buyerId: true, paymentStatus: true, totalCents: true },
        })
      : null

  const result = await prisma.order.updateMany({
    where: { pagarmeOrderId },
    data: { paymentStatus: nextStatus },
  })

  if (nextStatus === 'PAID' && result.count > 0 && before && before.paymentStatus !== 'PAID') {
    await createNotification(before.buyerId, {
      title: 'Pagamento confirmado',
      message: `Pagamento de ${formatCents(before.totalCents)} confirmado! Acompanhe em Meus pedidos.`,
      type: 'SUCCESS',
      href: '/pedidos',
    })
  }
}
