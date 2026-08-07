import { describe, it, expect } from 'vitest'
import { pagarmeRequest, type PagarmeOrderResponse } from './pagarmeClient'
import { buildSplitRules, calculateSplitCents } from './paymentService'

/**
 * Smoke-test OPCIONAL contra o sandbox real do Pagar.me. So roda se
 * PAGARME_SECRET_KEY e PAGARME_PLATFORM_RECIPIENT_ID estiverem no env — nas
 * maquinas/CI sem chave de sandbox, todo o describe e pulado
 * (`describe.skipIf`), entao o gate (`npm run gate`) nao depende delas.
 *
 * Cria um token de cartao de teste (via /tokens) e uma order Pix real, para
 * validar contra a API de verdade: (1) autenticacao Basic funciona, (2) o
 * split loja+plataforma da decisao de negocio de 2026-08-07 (liable na
 * plataforma, charge_processing_fee/charge_remainder_fee na loja) e aceito
 * pela API — ver o comentario de ATENCAO em paymentService.ts. Requer
 * tambem um recipient de loja de teste valido no sandbox
 * (PAGARME_TEST_STORE_RECIPIENT_ID) — sem ele, so o teste de token roda.
 */
const hasSandboxKeys = Boolean(process.env.PAGARME_SECRET_KEY && process.env.PAGARME_PLATFORM_RECIPIENT_ID)

describe.skipIf(!hasSandboxKeys)('smoke test — sandbox real do Pagar.me', () => {
  it('cria um token de cartao de teste via POST /tokens', async () => {
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

  it('cria uma order Pix real com o split loja/plataforma da decisao de negocio', async () => {
    const storeRecipientId = process.env.PAGARME_TEST_STORE_RECIPIENT_ID
    if (!storeRecipientId) return // sem recipient de loja de teste, pula (documentado no header do arquivo)

    const split = buildSplitRules(storeRecipientId)
    const { platformFeeCents, storeAmountCents } = calculateSplitCents(10000)
    expect(platformFeeCents + storeAmountCents).toBe(10000)

    const order = await pagarmeRequest<PagarmeOrderResponse>('/orders', {
      method: 'POST',
      body: {
        items: [{ amount: 10000, description: 'Smoke test fundacao pagamento', quantity: 1 }],
        customer: {
          name: 'Comprador Smoke Test',
          email: 'smoke-test@example.com',
          document: '00000000000',
          document_type: 'CPF',
          type: 'individual',
        },
        payments: [{ payment_method: 'pix', pix: { expires_in: 1800 }, split }],
      },
    })

    expect(order.id).toBeTruthy()
    expect(order.status).toBeTruthy()
  }, 20_000)
})
