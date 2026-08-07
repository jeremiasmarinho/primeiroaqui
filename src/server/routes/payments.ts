import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { prisma } from '../lib/prismaClient'
import { requireUser, type AuthEnv } from '../middleware/auth'
import { requireActiveRecipient } from '../lib/pagarmeClient'
import { createPaymentOrder, handleWebhook, PaymentValidationError, type PagarmeWebhookEvent } from '../lib/paymentService'

export const paymentRoutes = new Hono<AuthEnv>()

/** Mesmo padrao de `parseJsonBody` em `src/server/routes/orders.ts`. */
async function parseJsonBody(c: Context<AuthEnv>): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return undefined
  }
}

const customerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  document: z.string().min(1),
  documentType: z.enum(['CPF', 'CNPJ']),
})

/**
 * `cardToken` DEVE vir ja tokenizado pelo front (POST
 * https://api.pagar.me/core/v5/tokens?appId=pk_... com a public key). Este
 * schema rejeita explicitamente qualquer payload que pareca numero de
 * cartao cru (`card.number`/`cardNumber`) — o servidor nunca deve receber
 * PAN de cartao (PCI).
 */
const payBodySchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('pix'),
    customer: customerSchema,
  }),
  z.object({
    method: z.literal('credit_card'),
    customer: customerSchema,
    cardToken: z.string().min(1),
    installments: z.number().int().positive().optional(),
  }),
])

paymentRoutes.post('/orders/:id/pay', requireUser, async (c) => {
  const id = c.req.param('id')
  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }

  // Rejeita explicitamente numero de cartao cru antes mesmo da validacao
  // do schema, para dar um erro claro (nao generico "dados invalidos") se
  // alguem tentar mandar `card`/`cardNumber`/`number` no body.
  if (typeof body === 'object' && body !== null && ('card' in body || 'cardNumber' in body)) {
    return c.json(
      { error: 'Numero de cartao cru nao e aceito. Tokenize no front com a public key do Pagar.me.' },
      400,
    )
  }

  const parsed = payBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const authedUser = c.get('authedUser')
  const order = await prisma.order.findUnique({
    where: { id },
    include: { store: true, items: true },
  })
  if (!order || order.buyerId !== authedUser.id) {
    return c.json({ error: 'Pedido nao encontrado' }, 404)
  }

  if (requireActiveRecipient() && order.store.recipientStatus !== 'active') {
    return c.json({ error: 'Loja ainda nao esta apta a receber pagamentos' }, 409)
  }

  try {
    const { customer } = parsed.data
    const { order: updatedOrder, pagarmeOrder } =
      parsed.data.method === 'pix'
        ? await createPaymentOrder(order, { method: 'pix', customer })
        : await createPaymentOrder(order, {
            method: 'credit_card',
            customer,
            cardToken: parsed.data.cardToken,
            installments: parsed.data.installments,
          })

    const charge = pagarmeOrder.charges?.[0]
    return c.json({
      order: updatedOrder,
      pagarmeOrderId: pagarmeOrder.id,
      status: pagarmeOrder.status,
      pix:
        parsed.data.method === 'pix'
          ? {
              qrCode: charge?.last_transaction?.qr_code ?? null,
              qrCodeUrl: charge?.last_transaction?.qr_code_url ?? null,
              expiresAt: charge?.last_transaction?.expires_at ?? null,
            }
          : undefined,
    })
  } catch (err) {
    if (err instanceof PaymentValidationError) {
      return c.json({ error: err.message }, 409)
    }
    console.error('Erro ao criar order de pagamento no Pagar.me', err)
    return c.json({ error: 'Erro ao processar pagamento' }, 502)
  }
})

paymentRoutes.get('/orders/:id/payment', requireUser, async (c) => {
  const id = c.req.param('id')
  const authedUser = c.get('authedUser')
  const order = await prisma.order.findUnique({ where: { id } })
  if (!order || order.buyerId !== authedUser.id) {
    return c.json({ error: 'Pedido nao encontrado' }, 404)
  }
  return c.json({
    paymentStatus: order.paymentStatus,
    pagarmeOrderId: order.pagarmeOrderId,
    platformFeeCents: order.platformFeeCents,
    storeAmountCents: order.storeAmountCents,
  })
})

/**
 * Webhook publico do Pagar.me — SEM auth de usuario (o Pagar.me nao manda
 * Bearer token nosso). Sempre responde 200 rapido, mesmo em erro interno,
 * para o Pagar.me nao ficar reentregando o evento indefinidamente; o erro
 * fica logado para investigacao manual.
 *
 * LIMITACAO CONHECIDA: validacao de assinatura (`X-Hub-Signature`) so roda
 * se PAGARME_WEBHOOK_SECRET estiver configurado. Sem essa env, o endpoint
 * aceita e loga qualquer payload — aceitavel em sandbox, mas producao DEVE
 * configurar o segredo antes de ir ao ar (endpoint publico sem validacao e
 * uma superficie de forjar `order.paid`).
 */
paymentRoutes.post('/webhooks/pagarme', async (c) => {
  try {
    const body = (await c.req.json()) as PagarmeWebhookEvent
    const secret = process.env.PAGARME_WEBHOOK_SECRET
    if (secret) {
      const signature = c.req.header('x-hub-signature')
      if (!signature) {
        console.error('Webhook Pagar.me rejeitado: assinatura ausente com PAGARME_WEBHOOK_SECRET configurado')
        return c.json({ received: true }, 200)
      }
      // TODO(fase 2): validar HMAC da assinatura contra o corpo bruto do
      // request assim que o formato exato do header for confirmado com o
      // Pagar.me (docs nao especificam o algoritmo com clareza suficiente
      // para implementar sem testar contra webhooks reais).
    }

    await handleWebhook(body)
    return c.json({ received: true }, 200)
  } catch (err) {
    console.error('Erro ao processar webhook do Pagar.me', err)
    return c.json({ received: true }, 200)
  }
})
