/**
 * Tokenizacao de cartao NO NAVEGADOR — o numero do cartao NUNCA vai ao nosso
 * servidor (PCI). Fala direto com a Pagar.me usando a public key exposta por
 * `api.paymentsConfig()` (GET /api/payments/config).
 *
 * Confirmado em sandbox real (2026-08-07): a chamada e SEM header
 * Authorization — mandar o header devolve 401. A public key vai só como
 * querystring `appId`.
 */

const TOKENS_URL = 'https://api.pagar.me/core/v5/tokens'

export class CardTokenizeError extends Error {}

export interface CardInput {
  number: string
  holderName: string
  /** 2 dígitos, ex. "08". */
  expMonth: string
  /** 2 ou 4 dígitos, ex. "29" ou "2029". */
  expYear: string
  cvv: string
}

interface PagarmeTokenResponse {
  id: string
  type: string
}

interface PagarmeTokenErrorBody {
  message?: string
  errors?: Record<string, string[]>
}

/** Remove tudo que não é dígito — usado para normalizar número do cartão/CVV antes de mandar. */
const digitsOnly = (value: string): string => value.replace(/\D/g, '')

/**
 * Tokeniza o cartão preenchido no formulário e devolve o `card_token` para
 * `api.payOrder`. Lança `CardTokenizeError` com mensagem apresentável em
 * qualquer falha (rede ou 4xx/5xx do Pagar.me).
 */
export const tokenizeCard = async (publicKey: string, card: CardInput): Promise<string> => {
  let response: Response
  try {
    response = await fetch(`${TOKENS_URL}?appId=${encodeURIComponent(publicKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'card',
        card: {
          number: digitsOnly(card.number),
          holder_name: card.holderName,
          exp_month: Number(card.expMonth),
          exp_year: Number(card.expYear),
          cvv: digitsOnly(card.cvv),
        },
      }),
    })
  } catch {
    throw new CardTokenizeError('Não foi possível falar com o Pagar.me. Verifique sua conexão e tente novamente.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = undefined
  }

  if (!response.ok) {
    const body = payload as PagarmeTokenErrorBody | undefined
    throw new CardTokenizeError(body?.message ?? 'Não foi possível validar os dados do cartão.')
  }

  const token = payload as PagarmeTokenResponse
  if (!token?.id) {
    throw new CardTokenizeError('Resposta inesperada ao tokenizar o cartão.')
  }
  return token.id
}
