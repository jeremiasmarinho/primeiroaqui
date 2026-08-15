import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { vi } from 'vitest'
import { enterAsClient, waitForCatalog } from './authTestHelpers'
import { seedAddress, setGooglePayEnabled, setPaymentScenario } from './mocks/handlers'
import { ROUTES } from '../router/routes'

/**
 * Google Pay é chamado através do SDK real do Google (`pay.js`), que não
 * roda em jsdom — por isso este arquivo mocka `src/lib/googlePay.ts`
 * inteiro (a mesma fronteira que `src/lib/pagarmeTokenize.ts` teria, se
 * fosse mockado) e deixa o resto do fluxo (GET /payments/config, POST
 * /orders/:id/pay) passar pelo MSW normalmente, como o resto da suíte.
 */
const { isGooglePayReadyMock, requestGooglePaymentMock } = vi.hoisted(() => ({
  isGooglePayReadyMock: vi.fn(),
  requestGooglePaymentMock: vi.fn(),
}))

vi.mock('../lib/googlePay', async () => {
  const actual = await vi.importActual<typeof import('../lib/googlePay')>('../lib/googlePay')
  return {
    ...actual,
    isGooglePayReady: isGooglePayReadyMock,
    requestGooglePayment: requestGooglePaymentMock,
  }
})

describe('Google Pay no checkout', () => {
  beforeEach(() => {
    localStorage.clear()
    setPaymentScenario('paid')
    setGooglePayEnabled(true)
    isGooglePayReadyMock.mockReset().mockResolvedValue(true)
    requestGooglePaymentMock.mockReset().mockResolvedValue({
      token: { protocolVersion: 'ECv2', signature: 'sig', signedMessage: 'msg' },
      email: 'comprador@example.com',
      billingName: 'Ana Paula',
    })
  })

  afterEach(() => {
    setGooglePayEnabled(true)
  })

  const bottomNav = () => screen.getByRole('navigation', { name: /navegação principal/i })
  const openCart = () => fireEvent.click(within(bottomNav()).getByRole('button', { name: /carrinho/i }))
  const addFirstProduct = () =>
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)

  /** Chega até a etapa de pagamento com "Cartão" selecionado — Google Pay só aparece nesse método. */
  const goToPaymentStep = async () => {
    seedAddress()
    enterAsClient()
    await waitForCatalog()
    addFirstProduct()
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    fireEvent.change(screen.getByLabelText('Quem vai receber'), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cartão' }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))
    expect(await screen.findByRole('heading', { name: /pagamento/i })).toBeInTheDocument()
  }

  const fillValidCustomerFields = () => {
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-25' } })
    fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: '11987654321' } })
  }

  it('botão aparece quando googlePay.enabled=true e isReadyToPay resolve true', async () => {
    await goToPaymentStep()
    expect(await screen.findByRole('button', { name: /pagar com google pay/i })).toBeInTheDocument()
  })

  it('botão NÃO aparece quando GET /payments/config traz googlePay.enabled=false', async () => {
    setGooglePayEnabled(false)
    await goToPaymentStep()
    await waitFor(() => expect(screen.getByLabelText(/número do cartão/i)).not.toBeDisabled())
    expect(screen.queryByRole('button', { name: /pagar com google pay/i })).not.toBeInTheDocument()
  })

  it('botão NÃO aparece quando isReadyToPay resolve false — cai no formulário de cartão sem quebrar a tela', async () => {
    isGooglePayReadyMock.mockResolvedValue(false)
    await goToPaymentStep()
    await waitFor(() => expect(screen.getByLabelText(/número do cartão/i)).not.toBeDisabled())
    expect(screen.queryByRole('button', { name: /pagar com google pay/i })).not.toBeInTheDocument()
  })

  it('fluxo feliz: clique -> paymentData mockado -> POST /orders/:id/pay -> sucesso -> toast/navegação', async () => {
    await goToPaymentStep()
    fillValidCustomerFields()
    const button = await screen.findByRole('button', { name: /pagar com google pay/i })

    fireEvent.click(button)

    expect(await screen.findByText(/pagamento aprovado com google pay/i)).toBeInTheDocument()
    expect(requestGooglePaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({ gatewayMerchantId: 'acc_test_mock', environment: 'TEST' }),
    )

    fireEvent.click(screen.getByRole('button', { name: /ver meus pedidos/i }))
    await waitFor(() => expect(window.location.pathname).toBe(ROUTES.orders))
  })

  it('exige CPF/telefone válidos antes de abrir a folha do Google Pay', async () => {
    await goToPaymentStep()
    const button = await screen.findByRole('button', { name: /pagar com google pay/i })

    fireEvent.click(button)

    expect(await screen.findByText(/preencha cpf e telefone válidos/i)).toBeInTheDocument()
    expect(requestGooglePaymentMock).not.toHaveBeenCalled()
  })

  it('fluxo de erro: requestGooglePayment rejeita -> mensagem de erro, permite tentar de novo', async () => {
    const { GooglePayError } = await import('../lib/googlePay')
    requestGooglePaymentMock.mockRejectedValueOnce(new GooglePayError('Pagamento cancelado.'))
    await goToPaymentStep()
    fillValidCustomerFields()
    const button = await screen.findByRole('button', { name: /pagar com google pay/i })

    fireEvent.click(button)

    expect(await screen.findByText(/pagamento cancelado/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pagar com google pay/i })).toBeInTheDocument()

    requestGooglePaymentMock.mockResolvedValueOnce({
      token: { protocolVersion: 'ECv2', signature: 'sig', signedMessage: 'msg' },
      email: 'comprador@example.com',
      billingName: 'Ana Paula',
    })
    fireEvent.click(screen.getByRole('button', { name: /pagar com google pay/i }))
    expect(await screen.findByText(/pagamento aprovado com google pay/i)).toBeInTheDocument()
  })

  it('erro do servidor (cartão recusado) também aparece como erro do Google Pay', async () => {
    setPaymentScenario('declined')
    await goToPaymentStep()
    fillValidCustomerFields()
    const button = await screen.findByRole('button', { name: /pagar com google pay/i })

    fireEvent.click(button)

    expect(await screen.findByText(/cartão recusado pela operadora/i)).toBeInTheDocument()
  })
})
