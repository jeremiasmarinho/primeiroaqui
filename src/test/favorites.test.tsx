import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import MarketplaceApp from '../MarketplaceApp'
import FavoritesScreen from '../screens/FavoritesScreen'
import { ROUTES } from '../router/routes'
import { STORAGE_KEYS } from '../state/session'
import { makeProduct } from './factories'
import {
  clickEnterAsClient as enterAsClient,
  seedLoggedInStorage,
  waitForCatalog,
} from './authTestHelpers'

/** WU-48 — favoritos com endereço próprio. */
const goTo = (path: string) => {
  window.history.pushState({}, '', path)
}

const login = () => seedLoggedInStorage()

const baseProps = {
  favorites: [],
  onToggleFavorite: vi.fn(),
  onAddToCart: vi.fn(),
  onOpenCart: vi.fn(),
  cartCount: 0,
}

describe('FavoritesScreen — os tres estados', () => {
  it('carregando anuncia progresso em vez de mostrar lista vazia', () => {
    render(<FavoritesScreen {...baseProps} isLoading />)

    expect(screen.getByRole('status')).toHaveTextContent(/carregando/i)
    expect(screen.queryByText(/nenhum favorito/i)).not.toBeInTheDocument()
  })

  it('erro mostra o motivo e uma saida', () => {
    render(<FavoritesScreen {...baseProps} error="Não foi possível carregar seus favoritos." />)

    expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
    expect(screen.getByRole('link', { name: /explorar ofertas/i })).toHaveAttribute(
      'href',
      ROUTES.home,
    )
  })

  it('estado vazio tem acao de saida, nao deixa a pessoa presa', () => {
    render(<FavoritesScreen {...baseProps} />)

    expect(screen.getByText(/nenhum favorito salvo/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /explorar ofertas/i })).toHaveAttribute(
      'href',
      ROUTES.home,
    )
  })

  it('lista os favoritos com contagem visivel', () => {
    render(<FavoritesScreen {...baseProps} favorites={[makeProduct({ id: '3', title: 'Salvo A' })]} />)

    expect(screen.getByRole('link', { name: 'Salvo A' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/favoritos/i)
    expect(screen.getByText(/1 item/i)).toBeInTheDocument()
  })

  it('o controle de remover respeita o alvo minimo de toque', () => {
    render(<FavoritesScreen {...baseProps} favorites={[makeProduct({ id: '3', title: 'Salvo A' })]} />)

    const remove = screen.getByRole('button', { name: /remover salvo a dos favoritos/i })
    // Sem layout no jsdom, o contrato verificavel e a classe de tamanho:
    // h-11 = 44px, o minimo da WCAG 2.5.8 adotado pelo projeto.
    expect(remove.className).toMatch(/h-11|min-h-\[4[4-9]px\]|h-12/)
  })
})

describe('favoritos ponta a ponta', () => {
  beforeEach(() => {
    localStorage.clear()
    goTo('/')
  })

  const bottomNav = () => screen.getByRole('navigation', { name: /navegação principal/i })

  it('favoritar na vitrine, aparecer em /favoritos e sumir ao remover', async () => {
    render(<MarketplaceApp />)
    enterAsClient()
    await waitForCatalog()

    const save = screen.getAllByRole('button', {
      name: /^salvar .+ nos favoritos$/i,
    })[0] as HTMLElement
    const title = save.getAttribute('aria-label')?.replace(/^Salvar /, '').replace(/ nos favoritos$/, '') ?? ''
    fireEvent.click(save)

    fireEvent.click(within(bottomNav()).getByRole('link', { name: /favoritos/i }))
    expect(window.location.pathname).toBe(ROUTES.favorites)

    const main = screen.getByRole('main')
    expect(within(main).getByRole('link', { name: title })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`remover ${title} dos favoritos`, 'i') }))
    expect(screen.getByText(/nenhum favorito salvo/i)).toBeInTheDocument()
  })

  it('a barra inferior mostra o contador de favoritos', async () => {
    render(<MarketplaceApp />)
    enterAsClient()
    await waitForCatalog()
    fireEvent.click(screen.getAllByRole('button', { name: /^salvar .+ nos favoritos$/i })[0] as HTMLElement)

    expect(within(bottomNav()).getByRole('link', { name: /favoritos — 1 itens/i })).toBeInTheDocument()
  })

  it('deep link em /favoritos sem sessao volta para /entrar', () => {
    goTo(ROUTES.favorites)
    render(<MarketplaceApp />)

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
  })

  it('favoritos sobrevivem ao reload e continuam em /favoritos', async () => {
    const first = render(<MarketplaceApp />)
    enterAsClient()
    await waitForCatalog()
    fireEvent.click(screen.getAllByRole('button', { name: /^salvar .+ nos favoritos$/i })[0] as HTMLElement)
    first.unmount()

    login()
    goTo(ROUTES.favorites)
    render(<MarketplaceApp />)

    // A lista volta do GET /api/me/favorites (o MSW guarda o favorito do POST acima).
    expect((await screen.findAllByRole('button', { name: /^remover .+ dos favoritos$/i })).length).toBe(1)
    expect(screen.queryByText(/nenhum favorito salvo/i)).not.toBeInTheDocument()
  })
})
