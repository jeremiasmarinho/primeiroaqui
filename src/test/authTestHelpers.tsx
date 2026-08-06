import { fireEvent, render, screen, within, type RenderResult } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'
import { SESSION_STORAGE_KEY } from '../lib/api'
import { STORAGE_KEYS } from '../state/session'

/**
 * Vai para /entrar pelo ponto de entrada real: o link "Entrar" da barra de
 * navegação, visível na home (pública) quando ninguém está logado. Pressupõe
 * que o app já foi renderizado e a home está na tela.
 */
export const goToLoginFromNav = () => {
  const nav = screen.getByRole('navigation', { name: /navegação principal/i })
  fireEvent.click(within(nav).getByRole('link', { name: /^entrar$/i }))
}

/** Vai para /entrar e loga como cliente pelo atalho de desenvolvimento. Pressupõe app já renderizado. */
export const clickEnterAsClient = () => {
  goToLoginFromNav()
  fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))
}

/** Renderiza o app do zero e loga como cliente. */
export const enterAsClient = (): RenderResult => {
  const result = render(<MarketplaceApp />)
  clickEnterAsClient()
  return result
}

/**
 * Espera o catálogo real (mockado no MSW) chegar na tela — a vitrine agora
 * carrega por rede, então nenhum teste pode clicar num card antes disso.
 */
export const waitForCatalog = () =>
  screen.findAllByRole('button', { name: /adicionar .+ ao carrinho/i })

/**
 * Simula sessão persistida (deep link de quem já estava logado): usuário +
 * tokens no storage, como o app grava após um login real. O MSW aceita
 * qualquer Bearer, então o GET /api/me da inicialização revalida com sucesso.
 */
export const seedLoggedInStorage = (user: Partial<{ name: string; email: string }> = {}) => {
  localStorage.setItem(
    STORAGE_KEYS.user,
    JSON.stringify({ name: 'Ana Paula', email: 'ana@teste.com', role: 'BUYER', ...user }),
  )
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ accessToken: 'test-token', refreshToken: 'test-refresh', expiresAt: 9999999999 }),
  )
}
