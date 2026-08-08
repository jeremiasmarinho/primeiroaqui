import { describe, it, expect } from 'vitest'
import { pagarmeRequest, type PagarmeOrderResponse } from './pagarmeClient'
import { buildSplitRules, calculateSplitCents } from './paymentService'

/**
 * Smoke tests OPCIONAIS contra o sandbox real do Pagar.me — pulados
 * (`describe.skipIf`) em qualquer maquina/CI sem as chaves, entao o gate
 * (`npm run gate`) nao depende delas.
 *
 * Dois niveis, porque partes da conta de sandbox atual ainda dependem de
 * liberacao manual do suporte Pagar.me:
 *
 * (a) so com PAGARME_SECRET_KEY — valida o que a conta JA consegue fazer de
 *     verdade:
 *       - tokenizacao de cartao (POST /tokens)
 *       - order de CARTAO com billing_address: PAGA DE VERDADE
 *         (order.status/charge.status === "paid", confirmado em sandbox
 *         real 2026-08-07)
 *       - order de PIX: fica documentada como gateada (log claro do erro,
 *         SEM falhar o teste) — a conta responde `action_forbidden | Sem
 *         ambiente configurado para este tipo de transacao`, gate separado
 *         do de marketplace/split, aguardando liberacao do suporte.
 * (b) tambem com PAGARME_PLATFORM_RECIPIENT_ID + PAGARME_TEST_STORE_RECIPIENT_ID
 *     — o teste de split, so roda quando a conta tiver marketplace
 *     habilitado (hoje responde 412 "not allowed to create a recipient" em
 *     POST /recipients — ver MarketplaceNotEnabledError) e houver um
 *     recipient de loja de teste valido no sandbox.
 */
const hasSecretKey = Boolean(process.env.PAGARME_SECRET_KEY)
const hasSplitKeys = Boolean(process.env.PAGARME_SECRET_KEY && process.env.PAGARME_PLATFORM_RECIPIENT_ID && process.env.PAGARME_TEST_STORE_RECIPIENT_ID)

const TEST_CUSTOMER = {
  name: 'Comprador Smoke Test',
  document: '52998224725', // CPF de teste com digito verificador valido
  document_type: 'CPF' as const,
  type: 'individual' as const,
  // Obrigatorio na pratica (confirmado em sandbox real) para Pix e cartao
  // (antifraude) — ver PagarmeCustomer.phones em pagarmeClient.ts.
  phones: { mobile_phone: { country_code: '55', area_code: '11', number: '999999999' } },
}

describe.skipIf(!hasSecretKey)('smoke test (a) — sandbox real, SEM split (conta master)', () => {
  it('cria um token de cartao de teste via POST /tokens (sem Authorization header — ver nota no relatorio)', async () => {
    const publicKey = process.env.PAGARME_PUBLIC_KEY
    if (!publicKey) return // sem public key, pula silenciosamente (secret key sozinha nao basta pra tokenizar)

    const res = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${publicKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'card',
        card: {
          number: '4000000000000010',
          holder_name: 'Teste Sandbox',
          exp_month: 12,
          exp_year: 2030,
          cvv: '123',
        },
      }),
    })
    const body = (await res.json()) as { id?: string }
    expect(res.status).toBeLessThan(300)
    expect(body.id).toBeTruthy()
  }, 20_000)

  it('CARTAO + billing_address: order paga de verdade no sandbox (status "paid")', async () => {
    const publicKey = process.env.PAGARME_PUBLIC_KEY
    if (!publicKey) return // sem public key, pula silenciosamente

    const tokenRes = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${publicKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'card',
        card: { number: '4000000000000010', holder_name: 'Teste Sandbox', exp_month: 12, exp_year: 2030, cvv: '123' },
      }),
    })
    const token = (await tokenRes.json()) as { id: string }

    const order = await pagarmeRequest<PagarmeOrderResponse>('/orders', {
      method: 'POST',
      body: {
        // `code` obrigatorio por item (ver PagarmeOrderItem) — confirmado
        // pelo sandbox real.
        items: [{ amount: 10000, description: 'Smoke test cartao (com billing)', quantity: 1, code: 'smoke-item-1' }],
        customer: { ...TEST_CUSTOMER, email: `smoke-card-${Date.now()}@example.com` },
        payments: [
          {
            payment_method: 'credit_card',
            credit_card: {
              card_token: token.id,
              installments: 1,
              // billing_address vai em credit_card.card.billing_address
              // (nao direto em credit_card) — confirmado testando contra o
              // sandbox real; a doc so mostra esse aninhamento no exemplo
              // com numero de cartao cru, mas vale igual com card_token.
              card: {
                billing_address: {
                  line_1: 'Rua Teste, 123',
                  zip_code: '01000-000',
                  city: 'Sao Paulo',
                  state: 'SP',
                  country: 'BR',
                },
              },
            },
          },
        ],
      },
    })

    const charge = order.charges?.[0]

    // eslint-disable-next-line no-console -- resultado do smoke real, util pro relatorio manual
    console.log('[smoke a] order cartao com billing_address:', {
      id: order.id,
      status: order.status,
      chargeStatus: charge?.status,
    })

    expect(order.id).toBeTruthy()
    expect(order.status).toBe('paid')
    expect(charge?.status).toBe('paid')
  }, 20_000)

  it('PIX: gateado na conta — order e criada mas o charge falha (log documentado, sem falhar o teste)', async () => {
    // Email unico a cada run: o Pagar.me reusa o customer existente por
    // email e mantem o documento antigo cadastrado nele, o que mascarava
    // erros de CPF em runs repetidos durante o desenvolvimento deste teste.
    const order = await pagarmeRequest<PagarmeOrderResponse>('/orders', {
      method: 'POST',
      body: {
        items: [{ amount: 10000, description: 'Smoke test Pix (gateado)', quantity: 1, code: 'smoke-item-1' }],
        customer: { ...TEST_CUSTOMER, email: `smoke-pix-${Date.now()}@example.com` },
        payments: [{ payment_method: 'pix', pix: { expires_in: 1800 } }],
      },
    })

    // A ORDER em si (auth Basic + payload aceito pela API) e o que da pra
    // validar sem depender da liberacao — sempre deve vir com id e status.
    expect(order.id).toBeTruthy()
    expect(order.status).toBeTruthy()

    const charge = order.charges?.[0]

    // eslint-disable-next-line no-console -- resultado do smoke real, util pro relatorio manual
    console.log('[smoke a] order Pix (esperado gateado):', {
      id: order.id,
      status: order.status,
      chargeStatus: charge?.status,
      qrCodePresente: Boolean(charge?.last_transaction?.qr_code),
      gatewayError: (charge?.last_transaction as { gateway_response?: { errors?: unknown } } | undefined)?.gateway_response
        ?.errors,
    })

    // NAO falha o teste so por falta de qr_code: o ambiente Pix desta conta
    // de sandbox nao esta habilitado (`action_forbidden | Sem ambiente
    // configurado para este tipo de transacao` — gate de habilitacao do
    // Pagar.me, separado do de marketplace/split e ja confirmado
    // funcionando pelo caminho de cartao acima). Fica documentado no log
    // para o relatorio manual, e some assim que o suporte liberar Pix.
  }, 20_000)
})

describe.skipIf(!hasSplitKeys)('smoke test (b) — sandbox real, COM split (requer marketplace habilitado)', () => {
  it('cria uma order Pix real com o split loja/plataforma da decisao de negocio', async () => {
    const storeRecipientId = process.env.PAGARME_TEST_STORE_RECIPIENT_ID!

    const split = buildSplitRules(storeRecipientId)
    const { platformFeeCents, storeAmountCents } = calculateSplitCents(10000)
    expect(platformFeeCents + storeAmountCents).toBe(10000)

    const order = await pagarmeRequest<PagarmeOrderResponse>('/orders', {
      method: 'POST',
      body: {
        items: [{ amount: 10000, description: 'Smoke test fundacao pagamento (com split)', quantity: 1, code: 'smoke-item-1' }],
        customer: { ...TEST_CUSTOMER, email: `smoke-split-${Date.now()}@example.com` },
        payments: [{ payment_method: 'pix', pix: { expires_in: 1800 }, split }],
      },
    })

    expect(order.id).toBeTruthy()
    expect(order.status).toBeTruthy()
  }, 20_000)
})
