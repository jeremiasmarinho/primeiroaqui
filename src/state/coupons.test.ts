import { describe, expect, it } from 'vitest'
import { applyCoupon, COUPONS } from './coupons'
import type { Coupon } from '../types'

/** `now` fixo: sem isso o teste de expiração depende do dia em que roda. */
const NOW = new Date('2026-08-01T12:00:00.000Z')

const coupon = (overrides: Partial<Coupon> = {}): Coupon => ({
  code: 'TESTE',
  kind: 'percent',
  value: 10,
  minSubtotal: 0,
  expiresAt: '2099-01-01T00:00:00.000Z',
  description: 'cupom de teste',
  ...overrides,
})

describe('applyCoupon', () => {
  describe('rejeicoes', () => {
    it('rejeita codigo inexistente informando o motivo', () => {
      const result = applyCoupon('NAOEXISTE', 100, NOW)
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('deveria rejeitar')
      expect(result.reason).toBe('nao-encontrado')
      expect(result.message).toMatch(/nao encontrado|não encontrado/i)
    })

    it('rejeita cupom expirado', () => {
      const result = applyCoupon('EXPIRADO', 100, NOW)
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('deveria rejeitar')
      expect(result.reason).toBe('expirado')
    })

    it('rejeita quando o subtotal nao atinge o minimo', () => {
      const result = applyCoupon('PRIMEIRA20', 99.99, NOW)
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('deveria rejeitar')
      expect(result.reason).toBe('abaixo-do-minimo')
    })

    it('rejeita carrinho vazio antes de olhar o codigo', () => {
      const result = applyCoupon('BAIRRO10', 0, NOW)
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('deveria rejeitar')
      expect(result.reason).toBe('carrinho-vazio')
    })

    it('toda rejeicao traz mensagem nao vazia com caminho de recuperacao', () => {
      const cases = [
        applyCoupon('XXX', 100, NOW),
        applyCoupon('EXPIRADO', 100, NOW),
        applyCoupon('PRIMEIRA20', 10, NOW),
        applyCoupon('BAIRRO10', 0, NOW),
      ]
      cases.forEach((result) => {
        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.message.length).toBeGreaterThan(10)
      })
    })
  })

  describe('calculo', () => {
    it('aplica desconto percentual', () => {
      const result = applyCoupon('BAIRRO10', 200, NOW)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('deveria aceitar')
      expect(result.discount).toBe(20)
    })

    it('aplica desconto de valor fixo', () => {
      const result = applyCoupon('PRIMEIRA20', 150, NOW)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('deveria aceitar')
      expect(result.discount).toBe(20)
    })

    it('aceita exatamente no valor minimo', () => {
      const result = applyCoupon('PRIMEIRA20', 100, NOW)
      expect(result.ok).toBe(true)
    })

    it('arredonda o percentual para centavos', () => {
      const result = applyCoupon('BAIRRO10', 33.33, NOW, [
        coupon({ code: 'BAIRRO10', kind: 'percent', value: 10 }),
      ])
      if (!result.ok) throw new Error('deveria aceitar')
      expect(result.discount).toBe(3.33)
    })

    it('nunca desconta mais que o subtotal — cupom nao gera credito', () => {
      const result = applyCoupon('GIGANTE', 30, NOW, [
        coupon({ code: 'GIGANTE', kind: 'fixed', value: 500 }),
      ])
      if (!result.ok) throw new Error('deveria aceitar')
      expect(result.discount).toBe(30)
      expect(30 - result.discount).toBe(0)
    })

    it('desconto de 100% zera o total sem ficar negativo', () => {
      const result = applyCoupon('TUDO', 80, NOW, [
        coupon({ code: 'TUDO', kind: 'percent', value: 100 }),
      ])
      if (!result.ok) throw new Error('deveria aceitar')
      expect(80 - result.discount).toBe(0)
    })
  })

  describe('normalizacao do codigo', () => {
    it('aceita minuscula e espaco em volta', () => {
      const result = applyCoupon('  bairro10  ', 200, NOW)
      expect(result.ok).toBe(true)
    })
  })

  describe('expiracao depende do now injetado', () => {
    it('o mesmo cupom vale antes e nao vale depois da data', () => {
      const catalog = [coupon({ code: 'JANELA', expiresAt: '2026-08-02T00:00:00.000Z' })]
      const antes = applyCoupon('JANELA', 100, new Date('2026-08-01T00:00:00.000Z'), catalog)
      const depois = applyCoupon('JANELA', 100, new Date('2026-08-03T00:00:00.000Z'), catalog)

      expect(antes.ok).toBe(true)
      expect(depois.ok).toBe(false)
    })
  })

  describe('catalogo de demonstracao', () => {
    it('nao tem codigo duplicado', () => {
      const codes = COUPONS.map((item) => item.code)
      expect(new Set(codes).size).toBe(codes.length)
    })
  })
})
