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
  class IntersectionObserverStub implements IntersectionObserver {
    readonly root: Element | Document | null = null
    readonly rootMargin: string = '0px'
    readonly scrollMargin: string = '0px'
    readonly thresholds: readonly number[] = [0]
    readonly callback: IntersectionObserverCallback

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback
    }

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }

  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  cleanup()
  // Com roteamento por URL, um teste que navega deixa a rota suja para o
  // proximo. Resetar aqui evita ordem-dependencia entre arquivos de teste.
  window.history.pushState({}, '', '/')
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
