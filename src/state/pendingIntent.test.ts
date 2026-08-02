import { describe, expect, it } from 'vitest'
import { pendingIntentMessage } from './pendingIntent'
import type { PendingIntent } from './pendingIntent'

describe('pendingIntentMessage', () => {
  it('sem intencao, nao ha mensagem', () => {
    expect(pendingIntentMessage(null)).toBe('')
  })

  it('favoritar explica o motivo do redirecionamento', () => {
    const intent: PendingIntent = { type: 'favorite', productId: 7 }
    expect(pendingIntentMessage(intent)).toMatch(/favoritar/i)
  })

  it('retomar checkout explica o motivo do redirecionamento', () => {
    const intent: PendingIntent = { type: 'resume-checkout' }
    expect(pendingIntentMessage(intent)).toMatch(/continuar sua compra/i)
  })
})
