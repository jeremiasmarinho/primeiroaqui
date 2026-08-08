import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { enterAsClient, waitForCatalog } from './authTestHelpers'
import { seedAddress } from './mocks/handlers'
import { ROUTES } from '../router/routes'

describe('checkout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // O carrinho abre pela barra inferior. Buscar dentro da nav evita casar com
  // os botoes "Adicionar X ao carrinho" dos cards, que vem antes no DOM.
  const bottomNav = () => screen.getByRole('navigation', { name: /navegação principal/i })

  const openCart = () => {
    fireEvent.click(within(bottomNav()).getByRole('button', { name: /carrinho/i }))
  }

  const addFirstProduct = () => {
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
  }

  it('carrinho vazio nao avanca para entrega', async () => {
    enterAsClient()
    await waitForCatalog()
    openCart()
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    expect(screen.getByRole('heading', { name: /carrinho/i })).toBeInTheDocument()
  })

  it('subtotal atualiza ao adicionar item', async () => {
    enterAsClient()
    await waitForCatalog()

    addFirstProduct()
    expect(within(bottomNav()).getByRole('button', { name: /carrinho — 1 itens/i })).toBeInTheDocument()
  })

  it('exige nome e endereco salvo antes de fechar o pedido', async () => {
    enterAsClient()
    await waitForCatalog()

    addFirstProduct()
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))

    expect(screen.getByText(/informe o nome de quem recebe/i)).toBeInTheDocument()

    // Com nome mas sem endereco salvo, o backend nao teria addressId — o
    // checkout barra antes de chamar a API.
    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))

    expect(screen.getByText(/cadastre e selecione um endereço/i)).toBeInTheDocument()
  })

  it('cep visivelmente invalido e barrado antes da API', async () => {
    enterAsClient()
    await waitForCatalog()

    addFirstProduct()
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))

    expect(screen.getByText(/informe um cep valido/i)).toBeInTheDocument()
  })

  it('com endereco salvo, confirmar cria o pedido e abre a etapa de pagamento (Pix por padrao)', async () => {
    // Endereco pre-existente no "servidor": carregado via GET /me/addresses.
    seedAddress()
    enterAsClient()
    await waitForCatalog()

    addFirstProduct()
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))

    // POST /api/orders cria o pedido (PENDING) e a gaveta avanca para a
    // etapa de pagamento — o checkout so termina depois de pago (Fase 2).
    expect(await screen.findByRole('heading', { name: /pagamento/i })).toBeInTheDocument()

    // Pix puro também exige CPF/telefone (mesma exigência do servidor).
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-25' } })
    fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: '11987654321' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pagar' }))

    // Pix aprovado (mock 'paid' default) mostra o QR e o botao de conclusao.
    const finishButton = await screen.findByRole('button', { name: /ver meus pedidos/i })
    fireEvent.click(finishButton)

    await waitFor(() => expect(window.location.pathname).toBe(ROUTES.orders))
    expect(await screen.findByText(/ventilador de mesa premium/i)).toBeInTheDocument()
  })
})
