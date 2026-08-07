import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from './mocks/server'
import MarketplaceApp from '../MarketplaceApp'
import ResetPasswordScreen from '../screens/ResetPasswordScreen'
import { goToLoginFromNav } from './authTestHelpers'

describe('esqueci minha senha', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('abre o formulário de e-mail e mostra mensagem neutra de sucesso', async () => {
    render(<MarketplaceApp />)
    goToLoginFromNav()

    fireEvent.click(screen.getByRole('button', { name: /esqueci minha senha/i }))
    fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'ana@teste.com' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar link de redefinição/i }))

    await waitFor(() =>
      expect(screen.getByText(/se este e-mail estiver cadastrado/i)).toBeInTheDocument(),
    )
  })

  it('e-mail malformado: mensagem inline, sem chamar a API', async () => {
    let called = false
    server.use(
      http.post('/api/auth/forgot-password', () => {
        called = true
        return HttpResponse.json({ ok: true })
      }),
    )

    render(<MarketplaceApp />)
    goToLoginFromNav()
    fireEvent.click(screen.getByRole('button', { name: /esqueci minha senha/i }))
    fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'nao-e-email' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar link de redefinição/i }))

    expect(screen.getByText(/informe um e-mail v.lido/i)).toBeInTheDocument()
    expect(called).toBe(false)
  })

  it('mesma mensagem neutra mesmo se o backend responder 200 para e-mail inexistente', async () => {
    // O backend real sempre responde 200 (anti-enumeração) — o mock espelha isso.
    render(<MarketplaceApp />)
    goToLoginFromNav()
    fireEvent.click(screen.getByRole('button', { name: /esqueci minha senha/i }))
    fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'nao-existe@teste.com' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar link de redefinição/i }))

    await waitFor(() =>
      expect(screen.getByText(/se este e-mail estiver cadastrado/i)).toBeInTheDocument(),
    )
  })

  it('voltar para o login fecha o formulário de redefinição', async () => {
    render(<MarketplaceApp />)
    goToLoginFromNav()
    fireEvent.click(screen.getByRole('button', { name: /esqueci minha senha/i }))
    fireEvent.click(screen.getByRole('button', { name: /voltar para o login/i }))

    expect(screen.getByPlaceholderText('Senha')).toBeInTheDocument()
  })
})

describe('redefinir senha (/redefinir-senha)', () => {
  const setHash = (hash: string) => {
    window.location.hash = hash
  }

  afterEach(() => {
    window.location.hash = ''
  })

  it('sem tokens no fragmento: mostra link inválido', () => {
    setHash('')
    render(<ResetPasswordScreen onSuccess={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/link de redefinição inválido/i)
  })

  it('com tokens válidos: envia nova senha e chama onSuccess', async () => {
    setHash('#access_token=access-1&refresh_token=refresh-1&type=recovery')
    const onSuccess = vi.fn()
    render(<ResetPasswordScreen onSuccess={onSuccess} />)

    fireEvent.change(screen.getByPlaceholderText('Nova senha'), { target: { value: 'senha-nova-123' } })
    fireEvent.change(screen.getByPlaceholderText('Confirmar nova senha'), {
      target: { value: 'senha-nova-123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /salvar nova senha/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })

  it('senhas diferentes: erro inline, não chama a API', async () => {
    setHash('#access_token=access-1&refresh_token=refresh-1&type=recovery')
    const onSuccess = vi.fn()
    render(<ResetPasswordScreen onSuccess={onSuccess} />)

    fireEvent.change(screen.getByPlaceholderText('Nova senha'), { target: { value: 'senha-nova-123' } })
    fireEvent.change(screen.getByPlaceholderText('Confirmar nova senha'), {
      target: { value: 'outra-senha-456' },
    })
    fireEvent.click(screen.getByRole('button', { name: /salvar nova senha/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/não coincidem/i)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('senha curta: erro inline', () => {
    setHash('#access_token=access-1&refresh_token=refresh-1&type=recovery')
    render(<ResetPasswordScreen onSuccess={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('Nova senha'), { target: { value: '123' } })
    fireEvent.change(screen.getByPlaceholderText('Confirmar nova senha'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar nova senha/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/ao menos 8 caracteres/i)
  })

  it('token expirado: mensagem de erro do servidor', async () => {
    setHash('#access_token=token-expirado&refresh_token=refresh-1&type=recovery')
    render(<ResetPasswordScreen onSuccess={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('Nova senha'), { target: { value: 'senha-nova-123' } })
    fireEvent.change(screen.getByPlaceholderText('Confirmar nova senha'), {
      target: { value: 'senha-nova-123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /salvar nova senha/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/link de redefinicao invalido ou expirado/i),
    )
  })

  it('mostrar/ocultar senha alterna o tipo do campo', () => {
    setHash('#access_token=access-1&refresh_token=refresh-1&type=recovery')
    render(<ResetPasswordScreen onSuccess={() => {}} />)

    const input = screen.getByPlaceholderText('Nova senha') as HTMLInputElement
    expect(input.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: /mostrar senha/i }))
    expect(input.type).toBe('text')
  })
})
