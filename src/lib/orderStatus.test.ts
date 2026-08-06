import { describe, expect, it } from 'vitest'

import { API_ORDER_STATUSES, orderStatusLabel } from './orderStatus'

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
})
