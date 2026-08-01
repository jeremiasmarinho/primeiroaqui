import { formatCurrency } from './format'

describe('formatCurrency', () => {
  it('formata inteiro em BRL', () => {
    expect(formatCurrency(10)).toBe('R$\u00a010,00')
  })

  it('formata decimal em BRL', () => {
    expect(formatCurrency(129.9)).toBe('R$\u00a0129,90')
  })

  it('formata zero em BRL', () => {
    expect(formatCurrency(0)).toBe('R$\u00a00,00')
  })

  it('formata negativo em BRL', () => {
    expect(formatCurrency(-5)).toBe('-R$\u00a05,00')
  })

  it('retorna fallback para NaN', () => {
    expect(formatCurrency(Number.NaN)).toBe('R$\u00a00,00')
  })
})
