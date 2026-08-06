import { describe, expect, it } from 'vitest'

import { centsToReais, formatCents } from './money'

describe('money', () => {
  it('converte centavos inteiros para reais', () => {
    expect(centsToReais(19990)).toBe(199.9)
    expect(centsToReais(1)).toBe(0.01)
    expect(centsToReais(0)).toBe(0)
  })

  it('valor não finito degrada para zero em vez de NaN na tela', () => {
    expect(centsToReais(Number.NaN)).toBe(0)
    expect(centsToReais(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('formata centavos como BRL', () => {
    // Intl usa espaço não separável entre R$ e o número.
    expect(formatCents(19990).replace(/ /g, ' ')).toBe('R$ 199,90')
    expect(formatCents(0).replace(/ /g, ' ')).toBe('R$ 0,00')
  })
})
