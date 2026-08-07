import { prisma } from './prismaClient'
import {
  pagarmeRequest,
  getPlatformRecipientId,
  getPlatformFeePercent,
  type PagarmeBankAccount,
  type PagarmeCreateRecipientPayload,
  type PagarmeRecipientResponse,
  type PagarmeCreateOrderPayload,
  type PagarmeOrderResponse,
  type PagarmeSplitRule,
} from './pagarmeClient'
import type { Order, Store } from '@prisma/client'

export class PaymentValidationError extends Error {}

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
  const response = await pagarmeRequest<PagarmeRecipientResponse>('/recipients', {
    method: 'POST',
    body: payload,
  })

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
 * split rule (plataforma liable, loja paga a taxa). Isso NAO foi validado
 * contra o sandbox real ainda (sem chave configurada nesta fase) — o
 * smoke-test condicional em payments.smoke.test.ts tenta criar uma order Pix
 * real com este payload. Se o Pagar.me rejeitar essa combinacao quando as
 * chaves de sandbox forem adicionadas, ESTA FUNCAO precisa ser revisada
 * antes de qualquer uso real (o codigo nao deve ser considerado validado
 * ate o smoke-test passar).
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

export type PaymentCustomerInput = {
  name: string
  email: string
  document: string
  documentType: 'CPF' | 'CNPJ'
}

export type CreatePaymentOrderOptions =
  | { method: 'pix'; customer: PaymentCustomerInput }
  | { method: 'credit_card'; customer: PaymentCustomerInput; cardToken: string; installments?: number }

const PIX_EXPIRES_IN_SECONDS = 30 * 60

/**
 * Monta e cria a order de pagamento no Pagar.me (Pix ou cartao tokenizado),
 * com o split loja/plataforma acima, e persiste pagarmeOrderId +
 * paymentStatus=PENDING + platformFeeCents/storeAmountCents na Order local.
 *
 * NUNCA aceita numero de cartao cru — `cardToken` deve vir ja tokenizado
 * pelo front via POST https://api.pagar.me/core/v5/tokens?appId=pk_... (a
 * public key do Pagar.me, tokenizacao client-side). Isso e enforced na rota
 * (src/server/routes/payments.ts), nao aqui.
 */
export const createPaymentOrder = async (
  order: OrderWithItemsAndStore,
  options: CreatePaymentOrderOptions,
): Promise<{ order: Order; pagarmeOrder: PagarmeOrderResponse }> => {
  if (!order.store.pagarmeRecipientId) {
    throw new PaymentValidationError('Loja sem recipient Pagar.me configurado (pagarmeRecipientId ausente)')
  }

  const split = buildSplitRules(order.store.pagarmeRecipientId)
  const { platformFeeCents, storeAmountCents } = calculateSplitCents(order.totalCents)

  const customer = {
    name: options.customer.name,
    email: options.customer.email,
    document: options.customer.document,
    document_type: options.customer.documentType,
    type: (options.customer.documentType === 'CNPJ' ? 'company' : 'individual') as 'individual' | 'company',
  }

  const items = order.items.map((item, index) => ({
    amount: item.unitPriceCents,
    description: `Item ${index + 1}`,
    quantity: item.quantity,
  }))

  const payload: PagarmeCreateOrderPayload =
    options.method === 'pix'
      ? {
          items,
          customer,
          payments: [{ payment_method: 'pix', pix: { expires_in: PIX_EXPIRES_IN_SECONDS }, split }],
        }
      : {
          items,
          customer,
          payments: [
            {
              payment_method: 'credit_card',
              credit_card: { card_token: options.cardToken, installments: options.installments ?? 1 },
              split,
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

  await prisma.order.updateMany({
    where: { pagarmeOrderId },
    data: { paymentStatus: nextStatus },
  })
}
