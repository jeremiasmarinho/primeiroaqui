import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, afterAll, beforeAll } from 'vitest'
import { server } from './mocks/server'

/**
 * jsdom não implementa IntersectionObserver nem scrollIntoView, usados pelo
 * carrossel de banners. Stubs mínimos: registram os alvos observados sem
 * disparar callback, então o componente monta e o indicador fica no slide 0.
 * Testes que precisem simular a troca de slide devem acionar o callback
 * explicitamente em vez de depender de comportamento real de viewport.
 */
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
