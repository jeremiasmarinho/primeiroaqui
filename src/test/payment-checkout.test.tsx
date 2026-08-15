import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { enterAsClient, seedLoggedInStorage, waitForCatalog } from './authTestHelpers'
import { db, seedAddress, setPaymentScenario, setPaymentsEnabled } from './mocks/handlers'
import { ROUTES } from '../router/routes'
import { STORAGE_KEYS } from '../state/session'
import MarketplaceApp from '../MarketplaceApp'

/**
 * Etapa de pagamento (Fase 2): cartão tokenizado no navegador, Pix e os
 * caminhos de erro que a UI precisa distinguir (recusa vs. Pix gateado).
 */
describe('etapa de pagamento', () => {
  beforeEach(() => {
    localStorage.clear()
    setPaymentScenario('paid')
  })

  const bottomNav = () => screen.getByRole('navigation', { name: /navegação principal/i })
  const openCart = () => fireEvent.click(within(bottomNav()).getByRole('button', { name: /carrinho/i }))
  const addFirstProduct = () =>
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)

  /** Chega até a etapa de pagamento com o método escolhido (Pix por padrão do formulário). */
  const goToPaymentStep = async (method: 'Pix' | 'Cartão' = 'Pix') => {
    seedAddress()
    enterAsClient()
    await waitForCatalog()
    addFirstProduct()
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    fireEvent.change(screen.getByLabelText('Quem vai receber'), { target: { value: 'Ana' } })
    if (method === 'Cartão') {
      fireEvent.click(screen.getByRole('button', { name: 'Cartão' }))
    }
    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))
    expect(await screen.findByRole('heading', { name: /pagamento/i })).toBeInTheDocument()
  }

  const fillValidCustomerFields = () => {
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-25' } })
    fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: '11987654321' } })
  }

  const fillValidCardForm = () => {
    fireEvent.change(screen.getByLabelText(/número do cartão/i), { target: { value: '4000000000000010' } })
    fireEvent.change(screen.getByLabelText(/nome impresso no cartão/i), { target: { value: 'Ana Paula' } })
    fireEvent.change(screen.getByLabelText('Validade'), { target: { value: '12/29' } })
    fireEvent.change(screen.getByLabelText('CVV'), { target: { value: '123' } })
    fillValidCustomerFields()
  }

  /**
   * Item 3: CPF/telefone cadastrados no perfil pré-preenchem o checkout.
   * Precedência é `user > localStorage` (ver comentário em
   * usePaymentCheckoutState.ts `initialCustomerForm`) — grava um valor
   * DIFERENTE no localStorage para provar que o dado do perfil vence.
   */
  it('perfil com telefone/CPF salvos pré-preenche o checkout, sobrepondo o localStorage', async () => {
    localStorage.setItem(
      STORAGE_KEYS.paymentCustomer,
      JSON.stringify({ cpf: '999.999.999-99', phone: '(11) 90000-0000' }),
    )
    db.user.phone = '(31) 98888-7777'
    db.user.document = '111.444.777-35'
    seedAddress()
    // Diferente de `enterAsClient` (atalho dev que nunca chama GET /me),
    // sessão persistida dispara a revalidação real — é o único caminho para
    // o perfil (com telefone/CPF) chegar ao formulário.
    seedLoggedInStorage()
    render(<MarketplaceApp />)
    await waitForCatalog()
    addFirstProduct()
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    fireEvent.change(screen.getByLabelText('Quem vai receber'), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cartão' }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))
    expect(await screen.findByRole('heading', { name: /pagamento/i })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText(/número do cartão/i)).not.toBeDisabled())

    expect(screen.getByLabelText('CPF')).toHaveValue('111.444.777-35')
    expect(screen.getByLabelText(/telefone/i)).toHaveValue('(31) 98888-7777')
  })

  it('sem telefone/CPF no perfil, cai para o que já estava salvo no localStorage', async () => {
    localStorage.setItem(
      STORAGE_KEYS.paymentCustomer,
      JSON.stringify({ cpf: '529.982.247-25', phone: '(11) 98765-4321' }),
    )
    seedAddress()
    seedLoggedInStorage()
    render(<MarketplaceApp />)
    await waitForCatalog()
    addFirstProduct()
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    fireEvent.change(screen.getByLabelText('Quem vai receber'), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cartão' }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))
    expect(await screen.findByRole('heading', { name: /pagamento/i })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText(/número do cartão/i)).not.toBeDisabled())

    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-25')
    expect(screen.getByLabelText(/telefone/i)).toHaveValue('(11) 98765-4321')
  })

  it('cartão feliz: tokeniza, paga e conclui até a tela de pedidos', async () => {
    await goToPaymentStep('Cartão')
    // Public key vem de GET /api/payments/config, assíncrono.
    await waitFor(() => expect(screen.getByLabelText(/número do cartão/i)).not.toBeDisabled())

    fillValidCardForm()
    fireEvent.click(screen.getByRole('button', { name: 'Pagar' }))

    expect(await screen.findByText(/pagamento aprovado/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /ver meus pedidos/i }))

    await waitFor(() => expect(window.location.pathname).toBe(ROUTES.orders))
  })

  it('cartão recusado: mostra a mensagem do gateway e permite tentar de novo', async () => {
    setPaymentScenario('declined')
    await goToPaymentStep('Cartão')
    await waitFor(() => expect(screen.getByLabelText(/número do cartão/i)).not.toBeDisabled())

    fillValidCardForm()
    fireEvent.click(screen.getByRole('button', { name: 'Pagar' }))

    expect(await screen.findByText(/cartão recusado pela operadora/i)).toBeInTheDocument()
    // O formulário continua editável para nova tentativa — sem forçar o refazimento do pedido.
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()

    setPaymentScenario('paid')
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(await screen.findByText(/pagamento aprovado/i)).toBeInTheDocument()
  })

  it('validação inline barra CPF e número de cartão inválidos antes de chamar a API', async () => {
    await goToPaymentStep('Cartão')
    await waitFor(() => expect(screen.getByLabelText(/número do cartão/i)).not.toBeDisabled())

    fireEvent.change(screen.getByLabelText(/número do cartão/i), { target: { value: '1234' } })
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '111.111.111-11' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pagar' }))

    expect(screen.getByText(/número de cartão inválido/i)).toBeInTheDocument()
    expect(screen.getByText(/cpf inválido/i)).toBeInTheDocument()
  })

  it('Pix puro: exige CPF/telefone ANTES de gerar o QR (mesma exigência do servidor)', async () => {
    await goToPaymentStep('Pix')

    // Os campos existem no fluxo Pix (não só no cartão) — regressão do bug
    // real: servidor exige document/phone também para Pix (payments.ts),
    // mas a UI só coletava isso no fluxo cartão.
    expect(screen.getByLabelText('CPF')).toBeInTheDocument()
    expect(screen.getByLabelText(/telefone/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Pagar' }))

    expect(screen.getByText(/cpf inválido/i)).toBeInTheDocument()
    expect(screen.getByText(/telefone inválido/i)).toBeInTheDocument()
    // Validação bloqueou ANTES de chamar a API: nenhum QR é gerado.
    expect(screen.queryByText(/pague com pix/i)).not.toBeInTheDocument()
  })

  it('Pix gateado (action_forbidden): mensagem clara em vez do erro genérico', async () => {
    setPaymentScenario('pix_gated')
    await goToPaymentStep('Pix')
    fillValidCustomerFields()

    fireEvent.click(screen.getByRole('button', { name: 'Pagar' }))

    expect(await screen.findByText(/pix indisponível no momento, use cartão/i)).toBeInTheDocument()
  })

  it('Pix aprovado: mostra QR code, contagem de expiração e status "aguardando" (polling)', async () => {
    await goToPaymentStep('Pix')
    fillValidCustomerFields()
    fireEvent.click(screen.getByRole('button', { name: 'Pagar' }))

    expect(await screen.findByText(/pague com pix/i)).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent(/expira em/i)
    // Sandbox: sem pagador automático, GET /orders/:id/payment via polling
    // continua devolvendo PENDING — "aguardando" é o estado esperado.
    expect(await screen.findByText(/aguardando confirmação do pagamento/i)).toBeInTheDocument()
  })

  it('Pix: código copia-e-cola pode ser copiado para a área de transferência', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    await goToPaymentStep('Pix')
    fillValidCustomerFields()
    fireEvent.click(screen.getByRole('button', { name: 'Pagar' }))
    await screen.findByText(/pague com pix/i)

    fireEvent.click(screen.getByRole('button', { name: /copiar código pix/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('000201mockqrcode'))
    expect(await screen.findByText(/código copiado/i)).toBeInTheDocument()
  })
})

/**
 * Feature flag por ambiente (2026-08-07): produção não terá as chaves do
 * Pagar.me configuradas até o go-live de pagamento (dinheiro real) ser
 * decidido. GET /payments/config responde `{ enabled: false }` nesse caso —
 * a etapa de pagamento não deve nem aparecer.
 */
describe('feature flag: pagamento sem chaves no ambiente', () => {
  beforeEach(() => {
    localStorage.clear()
    setPaymentsEnabled(false)
  })

  afterEach(() => {
    setPaymentsEnabled(true)
  })

  const addFirstProduct = () =>
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)

  it('config disabled: checkout completa direto (toast + /pedidos), sem etapa de pagamento', async () => {
    seedAddress()
    enterAsClient()
    await waitForCatalog()
    addFirstProduct()
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    fireEvent.change(screen.getByLabelText('Quem vai receber'), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))

    // Fluxo pré-Fase 2: nenhuma etapa de pagamento aparece — vai direto pro histórico.
    await waitFor(() => expect(window.location.pathname).toBe(ROUTES.orders))
    expect(screen.queryByRole('heading', { name: /pagamento/i })).not.toBeInTheDocument()
    expect(await screen.findByText(/ventilador de mesa premium/i)).toBeInTheDocument()
  })

  it('config enabled (default): a etapa de pagamento aparece normalmente', async () => {
    setPaymentsEnabled(true)
    seedAddress()
    enterAsClient()
    await waitForCatalog()
    addFirstProduct()
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    fireEvent.change(screen.getByLabelText('Quem vai receber'), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))

    expect(await screen.findByRole('heading', { name: /pagamento/i })).toBeInTheDocument()
  })
})
