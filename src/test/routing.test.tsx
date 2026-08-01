import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'
import { ROUTES } from '../router/routes'

/**
 * WU-44 — roteamento com URL real.
 *
 * Os testes navegam via `history.pushState` antes de montar, que é o mesmo
 * caminho de um deep link vindo de fora (link no WhatsApp, notificação).
 */
const goTo = (path: string) => {
  window.history.pushState({}, '', path)
}

const login = () => {
  localStorage.setItem(
    'primeiroaqui_user',
    JSON.stringify({ name: 'Ana Paula', email: 'ana@teste.com', role: 'client' }),
  )
}

describe('rotas', () => {
  beforeEach(() => {
    localStorage.clear()
    goTo('/')
  })

  describe('deep link', () => {
    it('entrar direto em /produto/:id renderiza o produto certo', () => {
      login()
      goTo(ROUTES.product(3))
      render(<MarketplaceApp />)

      expect(screen.getByRole('heading', { name: /smartwatch fitness/i })).toBeInTheDocument()
    })

    it('id inexistente mostra estado vazio com saida, nao crash', () => {
      login()
      goTo(ROUTES.product(9999))

      expect(() => render(<MarketplaceApp />)).not.toThrow()
      expect(screen.getByText(/produto não encontrado/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /voltar às ofertas/i })).toBeInTheDocument()
    })

    it('entrar direto em /loja/:slug renderiza so os produtos daquela loja', () => {
      login()
      goTo(ROUTES.store('mercado-central'))
      render(<MarketplaceApp />)

      expect(screen.getByRole('heading', { name: /mercado central/i })).toBeInTheDocument()
      expect(screen.getByText(/kit supermercado express/i)).toBeInTheDocument()
      expect(screen.queryByText(/smartwatch fitness gps/i)).not.toBeInTheDocument()
    })

    it('slug de loja inexistente mostra estado vazio', () => {
      login()
      goTo(ROUTES.store('loja-que-nao-existe'))
      render(<MarketplaceApp />)

      expect(screen.getByText(/loja não encontrada/i)).toBeInTheDocument()
    })

    it('entrar direto em /categoria/:slug filtra o catalogo', () => {
      login()
      goTo(ROUTES.category('farmacia'))
      render(<MarketplaceApp />)

      expect(screen.getAllByText(/box de cuidados pessoais/i).length).toBeGreaterThan(0)
      expect(screen.queryByText(/smartwatch fitness gps/i)).not.toBeInTheDocument()
    })
  })

  describe('busca na URL', () => {
    it('a URL restaura o termo buscado', () => {
      login()
      goTo(`${ROUTES.search}?q=smartwatch`)
      render(<MarketplaceApp />)

      expect(screen.getByLabelText(/buscar produtos/i)).toHaveValue('smartwatch')
      expect(screen.getAllByText(/smartwatch fitness/i).length).toBeGreaterThan(0)
    })

    it('buscar reflete o termo na URL', () => {
      login()
      render(<MarketplaceApp />)

      fireEvent.change(screen.getByLabelText(/buscar produtos/i), {
        target: { value: 'ventilador' },
      })
      fireEvent.submit(screen.getByRole('search'))

      expect(window.location.pathname + window.location.search).toBe('/busca?q=ventilador')
    })
  })

  describe('guarda por papel', () => {
    it('/admin sem sessao de operacao nao renderiza o painel', async () => {
      login()
      goTo(ROUTES.admin())
      render(<MarketplaceApp />)

      // AdminScreen agora carrega via React.lazy (code splitting) — o
      // conteúdo aparece só depois que o chunk resolve, daí o findBy* em vez
      // de getBy* aqui.
      expect(await screen.findByText(/acesso restrito/i)).toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /agentes/i })).not.toBeInTheDocument()
    })

    it('rota desconhecida cai em pagina nao encontrada com saida', () => {
      login()
      goTo('/rota-que-nao-existe')
      render(<MarketplaceApp />)

      expect(screen.getByText(/página não encontrada/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /ir para a vitrine/i })).toBeInTheDocument()
    })
  })

  describe('sessao', () => {
    it('sem sessao, qualquer rota protegida leva para /entrar', () => {
      goTo(ROUTES.profile)
      render(<MarketplaceApp />)

      expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    })

    it('sem sessao, a vitrine tambem leva para /entrar', () => {
      // Comportamento preservado da versao anterior. Abrir a vitrine ao
      // publico e decisao de produto — ver nota em src/router/routes.ts.
      goTo(ROUTES.home)
      render(<MarketplaceApp />)

      expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    })

    it('deep link em rota protegida volta para o login, sem crash', () => {
      goTo(ROUTES.product(1))
      render(<MarketplaceApp />)

      expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    })
  })

  describe('navegacao entre telas atualiza a URL', () => {
    it('abrir um produto muda a URL', () => {
      login()
      render(<MarketplaceApp />)

      fireEvent.click(screen.getAllByRole('link', { name: /ventilador de mesa premium/i })[0] as HTMLElement)
      expect(window.location.pathname).toBe('/produto/1')
    })

    it('a barra inferior navega por URL, nao por estado interno', () => {
      login()
      render(<MarketplaceApp />)

      const nav = screen.getByRole('navigation', { name: /navegação principal/i })
      fireEvent.click(within(nav).getByRole('link', { name: /categorias/i }))

      expect(window.location.pathname).toBe('/categorias')
    })
  })
})
