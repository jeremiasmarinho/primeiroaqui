import { describe, expect, it } from 'vitest'

import { centsToReais, formatCents, parseBRLToCents } from './money'

describe('money', () => {
  it('parseBRLToCents aceita vírgula, ponto, R$ e milhar', () => {
    expect(parseBRLToCents('19,90')).toBe(1990)
    expect(parseBRLToCents('R$ 1.234,56')).toBe(123456)
    expect(parseBRLToCents('25')).toBe(2500)
    expect(parseBRLToCents('19.9')).toBe(1990)
  })

  it('parseBRLToCents rejeita entrada inválida ou não positiva', () => {
    expect(parseBRLToCents('')).toBeNull()
    expect(parseBRLToCents('abc')).toBeNull()
    expect(parseBRLToCents('1,234')).toBeNull()
    expect(parseBRLToCents('0')).toBeNull()
    expect(parseBRLToCents('-5')).toBeNull()
  })

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
