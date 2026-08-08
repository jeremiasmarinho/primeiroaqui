import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { prisma } from '../lib/prismaClient'
import { requireUser, type AuthEnv } from '../middleware/auth'
import { requireActiveRecipient, getPagarmePublicKey, PagarmeApiError } from '../lib/pagarmeClient'
import { createPaymentOrder, handleWebhook, PaymentValidationError, type PagarmeWebhookEvent } from '../lib/paymentService'

export const paymentRoutes = new Hono<AuthEnv>()

/**
 * Google Pay (2026-08-08): o `gatewayMerchantId` mandado ao SDK do Google no
 * front (e usado aqui como `merchant_identifier` no payload do Pagar.me) e o
 * id da nossa conta no Pagar.me. `PAGARME_ACCOUNT_ID` e a env preferida;
 * `GOOGLE_PAY_GATEWAY_MERCHANT_ID` e o fallback para quando o id da conta
 * ainda nao foi mapeado numa env dedicada. Sem nenhuma das duas, a feature
 * fica desligada (feature flag, mesmo padrao do pagamento geral) — o botao
 * nem aparece no front.
 */
const getGooglePayGatewayMerchantId = (): string | null =>
  process.env.PAGARME_ACCOUNT_ID || process.env.GOOGLE_PAY_GATEWAY_MERCHANT_ID || null

/** Ambiente do SDK do Google Pay (TEST nao exige merchant aprovado nem chave real). Default TEST. */
const getGooglePayEnvironment = (): string => process.env.GOOGLE_PAY_ENV || 'TEST'

const isGooglePayEnabled = (): boolean => Boolean(getGooglePayGatewayMerchantId())

/**
 * Config publica do Pagar.me para o front tokenizar cartao no navegador
 * (nunca expor a secret key). Sem `requireUser`: a public key nao e
 * segredo — e o mesmo dado que o Pagar.me espera ver em requests client-side.
 *
 * FEATURE FLAG por ambiente (decisao 2026-08-07): producao NAO tera as
 * chaves do Pagar.me configuradas ate o go-live de pagamento (dinheiro
 * real) ser decidido pelo usuario. Em vez de quebrar (500/503) quando as
 * chaves estao ausentes, a rota responde 200 `{ enabled: false }` — sinal
 * neutro que o front usa para nem oferecer a etapa de pagamento, caindo de
 * volta no fluxo pre-Fase 2 (pedido criado -> toast -> /pedidos,
 * paymentStatus NONE). Checa a SECRET key tambem, nao so a public: sem ela
 * `/orders/:id/pay` falharia de qualquer forma, entao "enabled" precisa
 * refletir o par completo, nao so a metade que da pra tokenizar.
 */
paymentRoutes.get('/payments/config', (c) => {
  const hasKeys = Boolean(process.env.PAGARME_SECRET_KEY) && Boolean(process.env.PAGARME_PUBLIC_KEY)
  const googlePay = {
    enabled: isGooglePayEnabled(),
    gatewayMerchantId: getGooglePayGatewayMerchantId() ?? '',
    environment: getGooglePayEnvironment(),
  }
  if (!hasKeys) {
    return c.json({ enabled: false as const, googlePay })
  }
  return c.json({ enabled: true as const, publicKey: getPagarmePublicKey(), googlePay })
})

/** Mesmo padrao de `parseJsonBody` em `src/server/routes/orders.ts`. */
async function parseJsonBody(c: Context<AuthEnv>): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return undefined
  }
}

/**
 * `phone` — confirmado obrigatorio na pratica em sandbox real (2026-08-07):
 * Pix e cartao (antifraude) rejeitam sem `customer.phones.mobile_phone`.
 * Opcional no schema porque o front (Fase 2) ainda vai coletar isso no
 * checkout; sem ele o Pagar.me recusa com mensagem propria, que a rota
 * repassa (502) em vez de fingir sucesso.
 */
const customerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  document: z.string().min(1),
  documentType: z.enum(['CPF', 'CNPJ']),
  phone: z
    .object({
      countryCode: z.string().min(1),
      areaCode: z.string().min(1),
      number: z.string().min(1),
    })
    .optional(),
})

/**
 * Endereco de cobranca do cartao — confirmado obrigatorio na pratica em
 * sandbox real (2026-08-07): sem ele o charge falha na validacao do
 * adquirente. Opcional no schema porque a rota deriva um default do
 * endereco de ENTREGA do pedido quando ausente (comportamento padrao de
 * e-commerce: cobranca = entrega, com override opcional do comprador).
 */
const billingAddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  zipCode: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  country: z.string().min(1),
})

/**
 * Shape do token que o front devolve apos `google.payments.api.
 * PaymentsClient.loadPaymentData` (JSON.parse de
 * paymentMethodData.tokenizationData.token, ver src/lib/googlePay.ts).
 * `protocolVersion`/`signature`/`signedMessage` sao os campos minimos que o
 * Pagar.me precisa para decriptar o token; `intermediateSigningKey` e
 * opcional (so aparece no formato ECv2 com signing key intermediaria) e
 * passa direto, sem validar o conteudo interno — o servidor nunca decripta
 * nada, so repassa para o Pagar.me.
 */
const googlePayTokenSchema = z.object({
  protocolVersion: z.string().min(1),
  signature: z.string().min(1),
  signedMessage: z.string().min(1),
  intermediateSigningKey: z.unknown().optional(),
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
    billingAddress: billingAddressSchema.optional(),
  }),
  z.object({
    method: z.literal('google_pay'),
    customer: customerSchema,
    googlePayToken: googlePayTokenSchema,
    installments: z.number().int().positive().optional(),
    billingAddress: billingAddressSchema.optional(),
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
    include: { store: true, items: true, address: true },
  })
  if (!order || order.buyerId !== authedUser.id) {
    return c.json({ error: 'Pedido nao encontrado' }, 404)
  }

  if (requireActiveRecipient() && order.store.recipientStatus !== 'active') {
    return c.json({ error: 'Loja ainda nao esta apta a receber pagamentos' }, 409)
  }

  if (parsed.data.method === 'google_pay' && !isGooglePayEnabled()) {
    return c.json({ error: 'Google Pay indisponivel no momento' }, 409)
  }

  // Default: cobranca = endereco de ENTREGA do pedido (padrao de
  // e-commerce). O comprador pode sobrescrever mandando `billingAddress`
  // explicito no body. Compartilhado por cartao e Google Pay.
  const defaultBillingAddress = {
    line1: order.address.number ? `${order.address.street}, ${order.address.number}` : order.address.street,
    line2: order.address.complement ?? undefined,
    zipCode: order.address.zipCode,
    city: order.address.city,
    state: order.address.state,
    country: 'BR',
  }

  try {
    const { customer } = parsed.data
    const { order: updatedOrder, pagarmeOrder } =
      parsed.data.method === 'pix'
        ? await createPaymentOrder(order, { method: 'pix', customer })
        : parsed.data.method === 'credit_card'
          ? await createPaymentOrder(order, {
              method: 'credit_card',
              customer,
              cardToken: parsed.data.cardToken,
              installments: parsed.data.installments,
              billingAddress: parsed.data.billingAddress ?? defaultBillingAddress,
            })
          : await createPaymentOrder(order, {
              method: 'google_pay',
              customer,
              googlePayToken: parsed.data.googlePayToken,
              // Nao-nulo aqui: `isGooglePayEnabled()` ja confirmou acima.
              gatewayMerchantId: getGooglePayGatewayMerchantId()!,
              installments: parsed.data.installments,
              billingAddress: parsed.data.billingAddress ?? defaultBillingAddress,
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
    // Pix gateado na conta sandbox (confirmado 2026-08-07): a API do
    // Pagar.me responde com um erro do tipo "action_forbidden" quando o
    // metodo pix nao esta liberado para a conta. Traduz num erro de
    // dominio claro em vez do 502 generico, para o front distinguir
    // "Pix indisponivel" de "gateway fora do ar".
    if (err instanceof PagarmeApiError) {
      const body = err.body as { type?: string; message?: string } | undefined
      if (body?.type === 'action_forbidden') {
        return c.json(
          { error: 'Pix indisponível no momento, use cartão', code: 'PAYMENT_METHOD_UNAVAILABLE' },
          409,
        )
      }
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
