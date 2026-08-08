import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, afterAll, beforeAll, beforeEach } from 'vitest'
import { server } from './mocks/server'
import { resetMockDb } from './mocks/handlers'
import { setHardNavigateForTests } from '../lib/hardNavigate'

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

/**
 * jsdom não navega de verdade (`window.location.assign` não desmonta nada) —
 * o mock padrão simula uma navegação "leve": reescreve a URL e dispara
 * popstate para o wouter reagir, mantendo a árvore React montada (memória
 * intacta). Isso é suficiente para a maioria dos testes, que só verificam
 * "caiu no destino certo, autenticado". Testes que precisam provar a
 * persistência através de um reload de VERDADE (memória perdida — ver Task 3
 * de hardNavigate) substituem por outra implementação e desmontam/remontam
 * manualmente.
 */
beforeEach(() => {
  setHardNavigateForTests((path) => {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
})

afterEach(() => {
  cleanup()
  // Com roteamento por URL, um teste que navega deixa a rota suja para o
  // proximo. Resetar aqui evita ordem-dependencia entre arquivos de teste.
  window.history.pushState({}, '', '/')
  server.resetHandlers()
  resetMockDb()
  // Sessão fake gravada por um teste não pode vazar para o próximo.
  window.localStorage.clear()
  // Idem para a intenção pendente pós-reload (primeiroaqui_pending_login) —
  // sem isso, um teste que grava e não chega a consumir vaza um pendingIntent
  // fantasma para o mount do próximo teste.
  window.sessionStorage.clear()
})

afterAll(() => {
  server.close()
})
