import { describe, expect, it } from 'vitest'
import {
  cardExpiryParts,
  formatCardExpiry,
  formatCardNumber,
  formatCpf,
  formatPhone,
  isValidCardExpiry,
  isValidCardNumber,
  isValidCpf,
  isValidCvv,
  isValidPhone,
  splitPhone,
} from './paymentValidation'

describe('formatCpf', () => {
  it('formata progressivamente', () => {
    expect(formatCpf('111')).toBe('111')
    expect(formatCpf('11122233344')).toBe('111.222.333-44')
  })
})

describe('isValidCpf', () => {
  it('aceita um CPF valido', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
  })
  it('rejeita digitos verificadores errados', () => {
    expect(isValidCpf('529.982.247-26')).toBe(false)
  })
  it('rejeita todos os digitos iguais', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false)
  })
  it('rejeita tamanho errado', () => {
    expect(isValidCpf('123')).toBe(false)
  })
})

describe('formatPhone / isValidPhone / splitPhone', () => {
  it('formata celular com DDD', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321')
  })
  it('valida 10 ou 11 digitos', () => {
    expect(isValidPhone('(11) 98765-4321')).toBe(true)
    expect(isValidPhone('(11) 8765-4321')).toBe(true)
    expect(isValidPhone('123')).toBe(false)
  })
  it('separa DDI/DDD/numero', () => {
    expect(splitPhone('(11) 98765-4321')).toEqual({ countryCode: '55', areaCode: '11', number: '987654321' })
  })
})

describe('formatCardNumber / isValidCardNumber (Luhn)', () => {
  it('formata em grupos de 4', () => {
    expect(formatCardNumber('4000000000000010')).toBe('4000 0000 0000 0010')
  })
  it('aceita o cartao de teste do sandbox', () => {
    expect(isValidCardNumber('4000000000000010')).toBe(true)
  })
  it('rejeita numero invalido pelo Luhn', () => {
    expect(isValidCardNumber('4000000000000011')).toBe(false)
  })
})

describe('formatCardExpiry / isValidCardExpiry / cardExpiryParts', () => {
  const now = new Date('2026-08-07T00:00:00Z')

  it('formata MM/AA', () => {
    expect(formatCardExpiry('0829')).toBe('08/29')
  })
  it('aceita mes/ano futuro', () => {
    expect(isValidCardExpiry('12/29', now)).toBe(true)
  })
  it('aceita o mes atual', () => {
    expect(isValidCardExpiry('08/26', now)).toBe(true)
  })
  it('rejeita data passada', () => {
    expect(isValidCardExpiry('01/20', now)).toBe(false)
  })
  it('rejeita mes invalido', () => {
    expect(isValidCardExpiry('13/29', now)).toBe(false)
  })
  it('separa mes/ano', () => {
    expect(cardExpiryParts('08/29')).toEqual({ expMonth: '08', expYear: '29' })
  })
})

describe('isValidCvv', () => {
  it('aceita 3 ou 4 digitos', () => {
    expect(isValidCvv('123')).toBe(true)
    expect(isValidCvv('1234')).toBe(true)
    expect(isValidCvv('12')).toBe(false)
  })
})
