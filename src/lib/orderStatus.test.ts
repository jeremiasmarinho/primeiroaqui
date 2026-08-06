import { describe, expect, it } from 'vitest'

import {
  API_ORDER_STATUSES,
  canCancelOrder,
  isValidOrderTransition,
  nextOrderStatus,
  orderStatusLabel,
} from './orderStatus'

describe('orderStatus', () => {
  it('todo status do enum do backend tem rótulo pt-BR', () => {
    for (const status of API_ORDER_STATUSES) {
      const label = orderStatusLabel(status)
      expect(label).not.toBe(status)
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('mapeia os rótulos principais', () => {
    expect(orderStatusLabel('PENDING')).toBe('Aguardando confirmação')
    expect(orderStatusLabel('DELIVERED')).toBe('Entregue')
    expect(orderStatusLabel('CANCELED')).toBe('Cancelado')
  })

  it('status desconhecido degrada para o valor cru', () => {
    expect(orderStatusLabel('NOVO_STATUS')).toBe('NOVO_STATUS')
  })

  it('valida as transições do fluxo feliz e os cancelamentos permitidos', () => {
    expect(isValidOrderTransition('PENDING', 'CONFIRMED')).toBe(true)
    expect(isValidOrderTransition('CONFIRMED', 'PREPARING')).toBe(true)
    expect(isValidOrderTransition('PREPARING', 'READY')).toBe(true)
    expect(isValidOrderTransition('READY', 'DELIVERED')).toBe(true)
    expect(isValidOrderTransition('PENDING', 'READY')).toBe(false)
    expect(isValidOrderTransition('DELIVERED', 'CANCELED')).toBe(false)
    expect(canCancelOrder('PENDING')).toBe(true)
    expect(canCancelOrder('CONFIRMED')).toBe(true)
    expect(canCancelOrder('PREPARING')).toBe(false)
  })

  it('nextOrderStatus devolve o próximo passo do fluxo feliz, nunca CANCELED', () => {
    expect(nextOrderStatus('PENDING')).toBe('CONFIRMED')
    expect(nextOrderStatus('READY')).toBe('DELIVERED')
    expect(nextOrderStatus('DELIVERED')).toBeNull()
    expect(nextOrderStatus('CANCELED')).toBeNull()
  })
})
