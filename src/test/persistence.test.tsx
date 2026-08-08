import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'
import { STORAGE_KEYS } from '../state/session'
import { clickEnterAsClient, enterAsClient, waitForCatalog } from './authTestHelpers'

/** WU-50 — persistência. Fecha a WU-16 do plano original. */
describe('persistencia', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const addFirstProduct = () => {
    fireEvent.click(
      screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement,
    )
  }

  describe('sobrevive ao reload', () => {
    it('carrinho e sessao voltam depois de remontar', async () => {
      const first = enterAsClient()
      await waitForCatalog()
      addFirstProduct()
      first.unmount()

      render(<MarketplaceApp />)
      const nav = screen.getByRole('navigation', { name: /navegação principal/i })
      expect(within(nav).getByRole('button', { name: /carrinho — 1 itens/i })).toBeInTheDocument()
    })

    it('favoritos voltam depois de remontar', async () => {
      const first = enterAsClient()
      await waitForCatalog()
      fireEvent.click(screen.getAllByRole('button', { name: /^salvar .+ nos favoritos$/i })[0] as HTMLElement)
      first.unmount()

      render(<MarketplaceApp />)
      expect(
        (await screen.findAllByRole('button', { name: /^remover .+ dos favoritos$/i })).length,
      ).toBeGreaterThan(0)
    })

    it('carrinho de visitante sobrevive ao reload sem sessao', async () => {
      const first = render(<MarketplaceApp />)
      await waitForCatalog()
      fireEvent.click(
        screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement,
      )
      first.unmount()

      render(<MarketplaceApp />)
      const nav = screen.getByRole('navigation', { name: /navegação principal/i })
      expect(within(nav).getByRole('button', { name: /carrinho — 1 itens/i })).toBeInTheDocument()
    })
  })

  describe('dado corrompido nao derruba o app (regressao B8)', () => {
    it('JSON invalido cai no fallback', () => {
      localStorage.setItem(STORAGE_KEYS.currentOrder, '{isso nao e json')
      localStorage.setItem(STORAGE_KEYS.business, 'null null')

      expect(() => render(<MarketplaceApp />)).not.toThrow()
      expect(screen.getByRole('navigation', { name: /navegação principal/i })).toBeInTheDocument()
    })

    it('JSON valido com formato errado nao concede sessao', () => {
      // Sem `email`, o objeto nao e um usuario valido.
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ apelido: 'Fulano' }))

      render(<MarketplaceApp />)
      const nav = screen.getByRole('navigation', { name: /navegação principal/i })
      expect(within(nav).getByRole('link', { name: 'Entrar' })).toBeInTheDocument()
    })

    it('carrinho no formato antigo (array cru) e migrado com quantidade 1', () => {
      localStorage.setItem(
        STORAGE_KEYS.user,
        JSON.stringify({ name: 'Ana', email: 'ana@teste.com', role: 'client' }),
      )
      localStorage.setItem(
        STORAGE_KEYS.cart,
        JSON.stringify([{ id: 1, title: 'Antigo', price: 10 }]),
      )

      render(<MarketplaceApp />)
      const nav = screen.getByRole('navigation', { name: /navegação principal/i })
      expect(within(nav).getByRole('button', { name: /carrinho — 1 itens/i })).toBeInTheDocument()
    })
  })

  describe('storage indisponivel', () => {
    it('app sobe quando localStorage lanca ao ser acessado', () => {
      const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('acesso negado (aba privada)')
        },
      })

      try {
        expect(() => render(<MarketplaceApp />)).not.toThrow()
        expect(screen.getByRole('navigation', { name: /navegação principal/i })).toBeInTheDocument()
      } finally {
        if (original) Object.defineProperty(window, 'localStorage', original)
      }
    })

    it('interagir sem storage nao quebra o fluxo', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded')
      })

      try {
        render(<MarketplaceApp />)
        // Sem storage funcional o app ainda tem que renderizar a entrada.
        expect(screen.getByRole('navigation', { name: /navegação principal/i })).toBeInTheDocument()
      } finally {
        setItem.mockRestore()
      }
    })
  })

  describe('logout limpa o que e da pessoa (regressoes B3 e B4)', () => {
    it('carrinho e favoritos nao vazam para o proximo login', async () => {
      render(<MarketplaceApp />)
      clickEnterAsClient()
      await waitForCatalog()
      addFirstProduct()
      fireEvent.click(screen.getByRole('button', { name: /fechar carrinho/i }))

      fireEvent.click(screen.getByRole('link', { name: /^mais$/i }))
      fireEvent.click(screen.getByRole('button', { name: /sair da conta/i }))

      // O carrinho passou a persistir sempre (Task 4 — visitante também
      // precisa sobreviver a reload), então logout não some com a chave;
      // esvazia o array. Sem itens não há nada de ninguém para vazar — o
      // invariante real de B3/B4 é "zero itens", não "chave ausente".
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.cart) ?? '{"items":[]}').items).toEqual([])
      expect(localStorage.getItem(STORAGE_KEYS.favorites)).toBeNull()
      expect(localStorage.getItem(STORAGE_KEYS.user)).toBeNull()

      // Logout agora faz hardNavigate(ROUTES.home) — a árvore volta pra home
      // pública (com BottomNav), não mais para /entrar. clickEnterAsClient()
      // vai pelo link "Entrar" da barra, como um visitante comum faria.
      clickEnterAsClient()
      const nav = screen.getByRole('navigation', { name: /navegação principal/i })
      expect(within(nav).getByRole('button', { name: 'Carrinho' })).toBeInTheDocument()
    })
  })
})
