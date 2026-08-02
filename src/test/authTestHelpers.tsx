import { fireEvent, render, screen, within, type RenderResult } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'

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
