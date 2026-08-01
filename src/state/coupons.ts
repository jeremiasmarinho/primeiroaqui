import type { Coupon } from '../types'

/**
 * Cupons de demonstração. Ao ligar o backend (WU-22), a validação sai daqui e
 * passa a ser feita no servidor — desconto validado no cliente é adulterável.
 */
export const COUPONS: Coupon[] = [
  {
    code: 'BAIRRO10',
    kind: 'percent',
    value: 10,
    minSubtotal: 50,
    expiresAt: '2027-12-31T23:59:59.000Z',
    description: '10% de desconto acima de R$ 50',
  },
  {
    code: 'PRIMEIRA20',
    kind: 'fixed',
    value: 20,
    minSubtotal: 100,
    expiresAt: '2027-12-31T23:59:59.000Z',
    description: 'R$ 20 de desconto acima de R$ 100',
  },
  {
    code: 'EXPIRADO',
    kind: 'percent',
    value: 50,
    minSubtotal: 0,
    expiresAt: '2020-01-01T00:00:00.000Z',
    description: 'Cupom vencido, usado em teste',
  },
]

export type CouponRejection =
  | 'nao-encontrado'
  | 'expirado'
  | 'abaixo-do-minimo'
  | 'carrinho-vazio'

export type CouponResult =
  | { ok: true; coupon: Coupon; discount: number }
  | { ok: false; reason: CouponRejection; message: string }

const MESSAGES: Record<CouponRejection, string> = {
  'nao-encontrado': 'Cupom não encontrado. Confira o código digitado.',
  expirado: 'Este cupom já expirou.',
  'abaixo-do-minimo': 'O valor do carrinho não atinge o mínimo deste cupom.',
  'carrinho-vazio': 'Adicione itens ao carrinho antes de aplicar um cupom.',
}

const reject = (reason: CouponRejection): CouponResult => ({
  ok: false,
  reason,
  message: MESSAGES[reason],
})

/**
 * Calcula o desconto de um cupom.
 *
 * `now` é injetado em vez de ler `Date.now()` — sem isso o teste de expiração
 * depende da data em que roda. O desconto nunca ultrapassa o subtotal: cupom
 * não gera crédito.
 */
export const applyCoupon = (
  rawCode: string,
  subtotal: number,
  now: Date,
  catalog: Coupon[] = COUPONS,
): CouponResult => {
  const code = rawCode.trim().toUpperCase()

  if (subtotal <= 0) return reject('carrinho-vazio')

  const coupon = catalog.find((item) => item.code === code)
  if (!coupon) return reject('nao-encontrado')

  if (new Date(coupon.expiresAt).getTime() <= now.getTime()) return reject('expirado')

  if (subtotal < coupon.minSubtotal) return reject('abaixo-do-minimo')

  const raw = coupon.kind === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value

  // Arredonda para centavos e nunca passa do subtotal.
  const discount = Math.min(subtotal, Math.round(raw * 100) / 100)

  return { ok: true, coupon, discount }
}
