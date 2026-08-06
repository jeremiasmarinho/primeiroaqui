import { fireEvent, render, screen } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'
import { goToLoginFromNav } from './authTestHelpers'

describe('auth flow', () => {
  const submitAuthForm = () => {
    const form = screen.getByPlaceholderText('Senha').closest('form') as HTMLFormElement
    fireEvent.submit(form)
  }

  beforeEach(() => {
    localStorage.clear()
  })

  it('submit sem email/senha nao autentica', () => {
    render(<MarketplaceApp />)
    goToLoginFromNav()
    submitAuthForm()
    expect(screen.getByText(/compre no bairro e gerencie suas vendas/i)).toBeInTheDocument()
  })

  it('rejeita email malformado com mensagem visivel', () => {
    render(<MarketplaceApp />)
    goToLoginFromNav()
    fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'email-invalido' } })
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: '12345678' } })
    submitAuthForm()
    expect(screen.getByText(/informe um e-mail valido/i)).toBeInTheDocument()
  })

  it('rejeita senha curta com mensagem visivel', () => {
    render(<MarketplaceApp />)
    goToLoginFromNav()
    fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'ana@teste.com' } })
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: '123' } })
    submitAuthForm()
    expect(screen.getByText(/senha deve ter ao menos 6 caracteres/i)).toBeInTheDocument()
  })

  it('regressao B5: role admin no localStorage nao libera painel', () => {
    localStorage.setItem('primeiroaqui_user', JSON.stringify({ name: 'Invasor', email: 'x@x.com', role: 'admin' }))

    render(<MarketplaceApp />)

    expect(screen.queryByRole('button', { name: 'Painel' })).not.toBeInTheDocument()
  })

  it('logout volta para login e limpa sessao', () => {
    localStorage.setItem('primeiroaqui_user', JSON.stringify({ name: 'Ana', email: 'ana@teste.com', role: 'client' }))
    localStorage.setItem('primeiroaqui_cart', JSON.stringify({ items: [{ product: { id: 1, title: 'Produto', price: 10 }, quantity: 1 }] }))

    render(<MarketplaceApp />)

    fireEvent.click(screen.getByRole('link', { name: /^mais$/i }))
    fireEvent.click(screen.getByRole('button', { name: /sair da conta/i }))

    expect(screen.getByText(/compre no bairro e gerencie suas vendas/i)).toBeInTheDocument()
    expect(localStorage.getItem('primeiroaqui_user')).toBeNull()
    // Desde a Task 4, o carrinho de visitante sobrevive ao logout de propósito
    // (persistencia deixou de depender de sessao) — o item some, mas a chave
    // permanece com uma lista vazia em vez de ser removida.
    expect(localStorage.getItem('primeiroaqui_cart')).toBe('{"items":[]}')
  })
})
