import { fireEvent, render, screen } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'
import { enterAsClient, goToLoginFromNav } from './authTestHelpers'

/**
 * WU-47 (resto) — busca com sugestões e histórico persistido.
 *
 * A restauração do termo via `?q=` já está coberta em `routing.test.tsx`
 * ("a URL restaura o termo buscado" / "buscar reflete o termo na URL") —
 * não duplicado aqui.
 */
describe('busca — sugestões e histórico', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const searchInput = () => screen.getByLabelText(/buscar produtos, lojas ou categorias/i)

  it('digitar mostra sugestões derivadas do catálogo (produto, categoria, loja)', () => {
    enterAsClient()
    fireEvent.focus(searchInput())
    fireEvent.change(searchInput(), { target: { value: 'smartwatch' } })

    expect(screen.getByRole('button', { name: /buscar por smartwatch fitness/i })).toBeInTheDocument()
  })

  it('campo vazio e focado mostra o histórico, não sugestões', () => {
    enterAsClient()
    fireEvent.focus(searchInput())
    fireEvent.change(searchInput(), { target: { value: 'ventilador' } })
    fireEvent.submit(screen.getByRole('search'))
    fireEvent.change(searchInput(), { target: { value: '' } })

    expect(screen.getByText(/buscas recentes/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /buscar novamente por ventilador/i })).toBeInTheDocument()
  })

  it('aplicar sugestão preenche o campo, executa a busca e filtra o catálogo', () => {
    enterAsClient()
    fireEvent.focus(searchInput())
    fireEvent.change(searchInput(), { target: { value: 'smartwatch' } })
    fireEvent.click(screen.getByRole('button', { name: /buscar por smartwatch fitness/i }))

    expect(searchInput()).toHaveValue('Smartwatch Fitness GPS à Prova d’Água')
    expect(window.location.pathname).toBe('/busca')
    expect(screen.getAllByText(/smartwatch fitness/i).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/ventilador de mesa premium/i)).toHaveLength(0)
  })

  it('aplicar sugestão registra o termo no histórico', () => {
    enterAsClient()
    fireEvent.focus(searchInput())
    fireEvent.change(searchInput(), { target: { value: 'smartwatch' } })
    fireEvent.click(screen.getByRole('button', { name: /buscar por smartwatch fitness/i }))

    fireEvent.change(searchInput(), { target: { value: '' } })
    expect(
      screen.getByRole('button', { name: /buscar novamente por smartwatch fitness/i }),
    ).toBeInTheDocument()
  })

  it('remover um item do histórico o tira da lista, sem afetar os outros', () => {
    enterAsClient()
    fireEvent.focus(searchInput())
    fireEvent.change(searchInput(), { target: { value: 'ventilador' } })
    fireEvent.submit(screen.getByRole('search'))
    fireEvent.change(searchInput(), { target: { value: 'whey' } })
    fireEvent.submit(screen.getByRole('search'))
    fireEvent.change(searchInput(), { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: /remover ventilador do histórico/i }))

    expect(screen.queryByRole('button', { name: /buscar novamente por ventilador/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /buscar novamente por whey/i })).toBeInTheDocument()
  })

  it('limpar o histórico esvazia a lista e persiste depois de remontar', () => {
    const first = render(<MarketplaceApp />)
    goToLoginFromNav()
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))
    fireEvent.focus(searchInput())
    fireEvent.change(searchInput(), { target: { value: 'whey' } })
    fireEvent.submit(screen.getByRole('search'))
    fireEvent.change(searchInput(), { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(screen.queryByRole('button', { name: /buscar novamente por whey/i })).not.toBeInTheDocument()
    first.unmount()

    render(<MarketplaceApp />)
    fireEvent.focus(searchInput())
    expect(screen.queryByRole('button', { name: /buscar novamente por whey/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/buscas recentes/i)).not.toBeInTheDocument()
  })

  it('o histórico sobrevive a um reload (remontar o app)', () => {
    const first = render(<MarketplaceApp />)
    goToLoginFromNav()
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))
    fireEvent.focus(searchInput())
    fireEvent.change(searchInput(), { target: { value: 'kit supermercado' } })
    fireEvent.submit(screen.getByRole('search'))
    first.unmount()

    render(<MarketplaceApp />)
    fireEvent.focus(searchInput())
    fireEvent.change(searchInput(), { target: { value: '' } })

    expect(
      screen.getByRole('button', { name: /buscar novamente por kit supermercado/i }),
    ).toBeInTheDocument()
  })

  it('busca sem resultado mostra estado vazio com ação de limpar', () => {
    enterAsClient()
    fireEvent.change(searchInput(), { target: { value: 'produto-inexistente-123' } })

    expect(screen.getByText(/nenhum produto encontrado/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /limpar filtros/i }))
    expect(searchInput()).toHaveValue('')
  })

  it('ArrowDown move o foco para a primeira sugestão; Escape fecha e devolve o foco ao campo', () => {
    enterAsClient()
    const input = searchInput()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'casa' } })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const firstOption = screen.getByRole('button', { name: 'Buscar por Casa' })
    expect(firstOption).toHaveFocus()

    fireEvent.keyDown(firstOption, { key: 'Escape' })
    expect(input).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Buscar por Casa' })).not.toBeInTheDocument()
  })
})
