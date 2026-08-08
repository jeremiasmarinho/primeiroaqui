import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'
import { db, MOCK_MFA_CODE, seedMfaEnrolled } from './mocks/handlers'
import { setHardNavigateForTests } from '../lib/hardNavigate'
import { goToLoginFromNav } from './authTestHelpers'


/**
 * Verificação em 2 etapas (TOTP): sub-etapa do login quando o usuário tem
 * fator ativo, e ativar/desativar na tela de perfil. QR real e código TOTP
 * de verdade não são testáveis sem um gerador — os mocks tratam
 * `MOCK_MFA_CODE` ('123456') como o único código "correto".
 */
describe('login com verificação em 2 etapas', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  const submitLogin = () => {
    fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'ana@teste.com' } })
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'senha-valida-123' } })
    fireEvent.submit(screen.getByPlaceholderText('Senha').closest('form') as HTMLFormElement)
  }

  it('senha correta com 2FA ativo pede o código antes de concluir o login', async () => {
    seedMfaEnrolled()
    render(<MarketplaceApp />)
    goToLoginFromNav()
    submitLogin()

    expect(await screen.findByLabelText(/código de verificação/i)).toBeInTheDocument()
    // Ainda não terminou o login — o formulário de senha não deveria mais aparecer.
    expect(screen.queryByPlaceholderText('Senha')).not.toBeInTheDocument()
  })

  it('código errado mostra erro e não navega', async () => {
    seedMfaEnrolled()
    let navigated = false
    setHardNavigateForTests(() => {
      navigated = true
    })
    render(<MarketplaceApp />)
    goToLoginFromNav()
    submitLogin()

    const codeInput = await screen.findByLabelText(/código de verificação/i)
    fireEvent.change(codeInput, { target: { value: '000000' } })
    fireEvent.submit(codeInput.closest('form') as HTMLFormElement)

    expect(await screen.findByRole('alert')).toHaveTextContent(/codigo invalido|código inválido/i)
    expect(navigated).toBe(false)
  })

  it('código correto conclui o login (hardNavigate para a home)', async () => {
    seedMfaEnrolled()
    let capturedPath: string | null = null
    setHardNavigateForTests((path) => {
      capturedPath = path
    })
    render(<MarketplaceApp />)
    goToLoginFromNav()
    submitLogin()

    const codeInput = await screen.findByLabelText(/código de verificação/i)
    fireEvent.change(codeInput, { target: { value: MOCK_MFA_CODE } })
    fireEvent.submit(codeInput.closest('form') as HTMLFormElement)

    await waitFor(() => expect(capturedPath).toBe('/'))
  })

  it('sem 2FA ativo, o login conclui direto (sem pedir código)', async () => {
    let capturedPath: string | null = null
    setHardNavigateForTests((path) => {
      capturedPath = path
    })
    render(<MarketplaceApp />)
    goToLoginFromNav()
    submitLogin()

    await waitFor(() => expect(capturedPath).toBe('/'))
    expect(screen.queryByLabelText(/código de verificação/i)).not.toBeInTheDocument()
  })
})

describe('ativar/desativar 2FA no perfil', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(
      'primeiroaqui_user',
      JSON.stringify({ name: 'Ana', email: 'ana@teste.com', role: 'BUYER' }),
    )
    localStorage.setItem(
      'primeiroaqui_session',
      JSON.stringify({ accessToken: 'test-token', refreshToken: 'test-refresh', expiresAt: 9999999999 }),
    )
    db.mfaFactorId = null
  })

  const openProfile = async () => {
    render(<MarketplaceApp />)
    fireEvent.click(screen.getByRole('link', { name: /^mais$/i }))
    await screen.findByText(/verificação em 2 etapas/i)
  }

  it('mostra "Inativa" e o botão de ativar quando não há fator', async () => {
    await openProfile()
    expect(await screen.findByText('Inativa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ativar verificação em 2 etapas/i })).toBeInTheDocument()
  })

  it('ativar: mostra QR code e confirma com o código', async () => {
    await openProfile()
    fireEvent.click(screen.getByRole('button', { name: /ativar verificação em 2 etapas/i }))

    expect(await screen.findByAltText(/qr code/i)).toBeInTheDocument()
    const codeInput = screen.getByLabelText(/código do app autenticador/i)
    fireEvent.change(codeInput, { target: { value: MOCK_MFA_CODE } })
    fireEvent.click(screen.getByRole('button', { name: /^ativar$/i }))

    await waitFor(() => expect(screen.getByText('Ativa')).toBeInTheDocument())
  })

  it('desativar: pede o código atual e confirma', async () => {
    seedMfaEnrolled()
    await openProfile()

    expect(await screen.findByText('Ativa')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /desativar verificação em 2 etapas/i }))

    const codeInput = await screen.findByLabelText(/digite o código atual/i)
    fireEvent.change(codeInput, { target: { value: MOCK_MFA_CODE } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar desativação/i }))

    await waitFor(() => expect(screen.getByText('Inativa')).toBeInTheDocument())
  })
})
