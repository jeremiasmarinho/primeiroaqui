import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import type { AxeResults, Result } from 'axe-core'
import MarketplaceApp from '../MarketplaceApp'
import { products } from '../data/catalog'
import { ROUTES } from '../router/routes'
import { STORAGE_KEYS } from '../state/session'
import {
  clickEnterAsClient as enterAsClient,
  goToLoginFromNav,
  seedLoggedInStorage,
  waitForCatalog,
} from './authTestHelpers'

/**
 * WU-50 — acessibilidade. Fecha a WU-15 do plano original.
 *
 * O corte é em `critical`/`serious`: violações `moderate`/`minor` do axe
 * incluem muito ruído de contexto que não se aplica a um app montado em jsdom.
 */
const blocking = (results: AxeResults): Result[] =>
  results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  )

const describeViolations = (violations: Result[]): string =>
  violations.map((v) => `${v.impact}: ${v.id} — ${v.help}`).join('\n')

describe('acessibilidade', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  /** Abre uma rota protegida direto, como um deep link com sessão ativa. */
  const openAsClient = (path: string) => {
    seedLoggedInStorage()
    window.history.pushState({}, '', path)
    return render(<MarketplaceApp />)
  }

  it('tela de login sem violacao critica ou seria', async () => {
    window.history.pushState({}, '', ROUTES.login)
    const { container } = render(<MarketplaceApp />)
    const violations = blocking((await axe(container)) as AxeResults)
    expect(describeViolations(violations)).toBe('')
  })

  it('home sem violacao critica ou seria', async () => {
    const { container } = render(<MarketplaceApp />)
    enterAsClient()

    const violations = blocking((await axe(container)) as AxeResults)
    expect(describeViolations(violations)).toBe('')
  })

  it('gaveta do carrinho sem violacao critica ou seria', async () => {
    const { container } = render(<MarketplaceApp />)
    enterAsClient()
    await waitForCatalog()
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)

    const violations = blocking((await axe(container)) as AxeResults)
    expect(describeViolations(violations)).toBe('')
  })

  it('checkout sem violacao critica ou seria', async () => {
    const { container } = render(<MarketplaceApp />)
    enterAsClient()
    await waitForCatalog()
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    const violations = blocking((await axe(container)) as AxeResults)
    expect(describeViolations(violations)).toBe('')
  })

  it('favoritos com itens sem violacao critica ou seria', async () => {
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(products.slice(0, 2)))
    const { container } = openAsClient(ROUTES.favorites)

    const violations = blocking((await axe(container)) as AxeResults)
    expect(describeViolations(violations)).toBe('')
  })

  it('favoritos vazio sem violacao critica ou seria', async () => {
    const { container } = openAsClient(ROUTES.favorites)

    const violations = blocking((await axe(container)) as AxeResults)
    expect(describeViolations(violations)).toBe('')
  })

  it('historico de pedidos sem violacao critica ou seria', async () => {
    const { container } = openAsClient(ROUTES.orders)

    const violations = blocking((await axe(container)) as AxeResults)
    expect(describeViolations(violations)).toBe('')
  })

  it('enderecos sem violacao critica ou seria', async () => {
    const { container } = openAsClient(ROUTES.addresses)

    const violations = blocking((await axe(container)) as AxeResults)
    expect(describeViolations(violations)).toBe('')
  })

  it('categorias sem violacao critica ou seria', async () => {
    const { container } = openAsClient(ROUTES.categories)

    const violations = blocking((await axe(container)) as AxeResults)
    expect(describeViolations(violations)).toBe('')
  })

  it('busca com sugestoes abertas sem violacao critica ou seria', async () => {
    const { container } = openAsClient(ROUTES.search)
    const input = screen.getByLabelText(/buscar produtos, lojas ou categorias/i)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'casa' } })

    const violations = blocking((await axe(container)) as AxeResults)
    expect(describeViolations(violations)).toBe('')
  })

  it('busca com historico aberto sem violacao critica ou seria', async () => {
    localStorage.setItem(STORAGE_KEYS.searchHistory, JSON.stringify(['ventilador', 'whey']))
    const { container } = openAsClient(ROUTES.search)
    fireEvent.focus(screen.getByLabelText(/buscar produtos, lojas ou categorias/i))

    const violations = blocking((await axe(container)) as AxeResults)
    expect(describeViolations(violations)).toBe('')
  })

  it('painel admin sem violacao critica ou seria', async () => {
    const { container } = render(<MarketplaceApp />)
    goToLoginFromNav()
    fireEvent.click(screen.getByRole('button', { name: /entrar como operação/i }))
    fireEvent.click(screen.getByRole('link', { name: /^mais$/i }))
    // AdminScreen carrega via React.lazy — espera o chunk resolver antes de
    // rodar o axe, em vez de depender do timing implícito do `await axe()`.
    await screen.findByRole('heading', { level: 1 })

    const violations = blocking((await axe(container)) as AxeResults)
    expect(describeViolations(violations)).toBe('')
  })
})

describe('semantica dos controles', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('nenhum botao de icone fica sem nome acessivel', () => {
    render(<MarketplaceApp />)
    goToLoginFromNav()
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))

    const unnamed = screen
      .getAllByRole('button')
      .filter((button) => !button.textContent?.trim() && !button.getAttribute('aria-label'))

    expect(unnamed).toHaveLength(0)
  })

  it('todo campo de formulario do checkout tem label associado', async () => {
    render(<MarketplaceApp />)
    goToLoginFromNav()
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))
    await waitForCatalog()
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    const drawer = screen.getByRole('dialog')
    const inputs = within(drawer).getAllByRole('textbox')

    inputs.forEach((input) => {
      const id = input.getAttribute('id')
      expect(id, 'todo input precisa de id para o label apontar').toBeTruthy()
      expect(document.querySelector(`label[for="${id}"]`)).toBeTruthy()
    })
  })

  it('a gaveta do carrinho se declara como dialogo modal', async () => {
    render(<MarketplaceApp />)
    goToLoginFromNav()
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))
    await waitForCatalog()
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName()
  })

  it('a hierarquia de titulos comeca em h1 e nao pula nivel', async () => {
    render(<MarketplaceApp />)
    goToLoginFromNav()
    fireEvent.click(screen.getByRole('button', { name: /entrar como operação/i }))
    fireEvent.click(screen.getByRole('link', { name: /^mais$/i }))
    // AdminScreen carrega via React.lazy — espera o chunk resolver antes de
    // inspecionar a hierarquia de headings.
    await screen.findByRole('heading', { level: 1 })

    const levels = screen
      .getAllByRole('heading')
      .map((heading) => Number(heading.tagName.replace('H', '')))

    expect(levels[0]).toBe(1)
    levels.slice(1).forEach((level, index) => {
      expect(level - (levels[index] as number)).toBeLessThanOrEqual(1)
    })
  })
})
