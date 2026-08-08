import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import MarketplaceApp from '../MarketplaceApp'
import AddressesScreen from '../screens/AddressesScreen'
import { ROUTES } from '../router/routes'
import { EMPTY_ADDRESS } from '../state/addresses'
import { makeAddress } from './factories'
import { seedLoggedInStorage, waitForCatalog } from './authTestHelpers'
import { server } from './mocks/server'

/**
 * WU-48 → fase de integração — endereços vêm de POST/GET/PATCH/DELETE reais
 * (/api/addresses via MSW). Editar, definir padrão e excluir também são
 * testados ponta a ponta abaixo.
 */
const goTo = (path: string) => {
  window.history.pushState({}, '', path)
}

const baseProps = {
  addresses: [],
  addressForm: EMPTY_ADDRESS,
  addressError: '',
  onAddressFormChange: vi.fn(),
  onAddressSubmit: vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
}

describe('AddressesScreen — os tres estados', () => {
  it('carregando anuncia progresso', () => {
    render(<AddressesScreen {...baseProps} isLoading />)
    expect(screen.getByRole('status')).toHaveTextContent(/carregando/i)
  })

  it('erro mostra motivo e saida', () => {
    render(<AddressesScreen {...baseProps} error="Não foi possível carregar seus endereços." />)

    expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
    expect(screen.getByRole('link', { name: /explorar ofertas/i })).toHaveAttribute(
      'href',
      ROUTES.home,
    )
  })

  it('lista vazia explica e oferece saida, sem esconder o formulario', () => {
    render(<AddressesScreen {...baseProps} />)

    expect(screen.getByText(/nenhum endereço salvo/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /explorar ofertas/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Rua')).toBeInTheDocument()
  })

  it('o cep e o primeiro campo do formulario', () => {
    render(<AddressesScreen {...baseProps} />)

    const inputs = screen.getAllByRole('textbox')
    expect(inputs[0]).toHaveAttribute('id', 'endereco-cep')
  })

  it('todo campo do formulario tem label associado', () => {
    const { container } = render(<AddressesScreen {...baseProps} />)

    container.querySelectorAll('input').forEach((input) => {
      expect(input.id, 'input sem id nao pode ser associado a label').toBeTruthy()
      expect(container.querySelector(`label[for="${input.id}"]`)).toBeTruthy()
    })
  })

  it('o endereco padrao se anuncia com selo', () => {
    render(<AddressesScreen {...baseProps} addresses={[makeAddress({ id: 'end-1', isDefault: true })]} />)

    expect(screen.getByText(/padrão/i)).toBeInTheDocument()
  })

  it('o erro de validacao aparece como alerta', () => {
    render(<AddressesScreen {...baseProps} addressError="Informe a cidade da entrega." />)
    expect(screen.getByRole('alert')).toHaveTextContent(/informe a cidade/i)
  })
})

describe('enderecos ponta a ponta', () => {
  beforeEach(() => {
    localStorage.clear()
    goTo('/')
  })

  // A tela busca GET /me/addresses ao montar; o formulário só aparece
  // depois do loading — espere-o antes de preencher.
  const fillAddress = async (values: {
    label: string
    street: string
    number?: string
    complement?: string
    city: string
    state?: string
    cep: string
  }) => {
    fireEvent.change(await screen.findByLabelText('CEP'), { target: { value: values.cep } })
    fireEvent.change(screen.getByLabelText('Rua'), { target: { value: values.street } })
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: values.city } })
    fireEvent.change(screen.getByLabelText('Estado (UF)'), { target: { value: values.state ?? 'SP' } })
    if (values.number !== undefined) {
      fireEvent.change(screen.getByLabelText('Número'), { target: { value: values.number } })
    }
    if (values.complement !== undefined) {
      fireEvent.change(screen.getByLabelText('Complemento'), { target: { value: values.complement } })
    }
    fireEvent.change(screen.getByLabelText('Nome do endereço'), { target: { value: values.label } })
    fireEvent.click(screen.getByRole('button', { name: /salvar endereço/i }))
  }

  const casa = { label: 'Casa', street: 'Rua das Flores', number: '45', city: 'Centro', cep: '12345678' }

  it('cadastra via POST real, mascara o cep e marca o primeiro como padrao', async () => {
    seedLoggedInStorage()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    await fillAddress(casa)

    const list = await screen.findByRole('list', { name: /endereços salvos/i })
    expect(within(list).getByText(/rua das flores, 45/i)).toBeInTheDocument()
    expect(within(list).getByText('12345-678')).toBeInTheDocument()
    expect(within(list).getByText(/padrão/i)).toBeInTheDocument()
  })

  it('cep invalido e rejeitado antes da API, com mensagem que ensina o formato', async () => {
    seedLoggedInStorage()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    await fillAddress({ ...casa, cep: '123' })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/00000-000/)
    expect(screen.queryByRole('list', { name: /endereços salvos/i })).not.toBeInTheDocument()
  })

  it('estado (UF) vazio e rejeitado — o backend exige o campo', async () => {
    seedLoggedInStorage()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    await fillAddress({ ...casa, state: ' ' })

    expect(await screen.findByRole('alert')).toHaveTextContent(/estado/i)
  })

  it('o cabecalho anuncia o endereco padrao cadastrado', async () => {
    seedLoggedInStorage()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    await fillAddress(casa)
    await screen.findByRole('list', { name: /endereços salvos/i })
    fireEvent.click(screen.getByRole('link', { name: /voltar às ofertas/i }))

    expect(await screen.findByText(/enviar para rua das flores, 45/i)).toBeInTheDocument()
  })

  it('o endereco padrao ja vem escolhido ao abrir a entrega', async () => {
    seedLoggedInStorage()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    await fillAddress(casa)
    await screen.findByRole('list', { name: /endereços salvos/i })
    fireEvent.click(screen.getByRole('link', { name: /voltar às ofertas/i }))
    await waitForCatalog()

    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    expect(screen.getByRole('radio', { name: /casa/i })).toBeChecked()
    expect(screen.getByLabelText('Endereço')).toHaveValue('Rua das Flores, 45')
    expect(screen.getByLabelText('CEP')).toHaveValue('12345-678')
  })

  it('sem endereco salvo, o checkout convida a cadastrar em vez de fingir', async () => {
    seedLoggedInStorage()
    render(<MarketplaceApp />)
    await waitForCatalog()

    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('link', { name: /cadastrar endereço/i })).toHaveAttribute(
      'href',
      ROUTES.addresses,
    )
  })

  it('cep invalido no checkout explica o formato esperado', async () => {
    seedLoggedInStorage()
    render(<MarketplaceApp />)
    await waitForCatalog()

    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Endereço'), { target: { value: 'Rua 1' } })
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Centro' } })
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/00000-000/)
  })

  it('o campo de cep do checkout aplica a mascara enquanto digita', async () => {
    seedLoggedInStorage()
    render(<MarketplaceApp />)
    await waitForCatalog()

    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '12345678' } })
    expect(screen.getByLabelText('CEP')).toHaveValue('12345-678')
  })

  it('enderecos sobrevivem ao reload — a lista volta do servidor', async () => {
    seedLoggedInStorage()
    goTo(ROUTES.addresses)
    const first = render(<MarketplaceApp />)
    await fillAddress(casa)
    await screen.findByRole('list', { name: /endereços salvos/i })
    first.unmount()

    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    expect(await screen.findByText(/rua das flores, 45/i)).toBeInTheDocument()
  })

  it('cep valido preenche rua/cidade/uf automaticamente (autofill ViaCEP)', async () => {
    server.use(
      http.get('https://viacep.com.br/ws/:cep/json/', () =>
        HttpResponse.json({ logradouro: 'Avenida Paulista', localidade: 'São Paulo', uf: 'SP' }),
      ),
    )
    seedLoggedInStorage()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    fireEvent.change(await screen.findByLabelText('CEP'), { target: { value: '01310100' } })

    expect(await screen.findByLabelText('Rua')).toHaveValue('Avenida Paulista')
    expect(screen.getByLabelText('Cidade')).toHaveValue('São Paulo')
    expect(screen.getByLabelText('Estado (UF)')).toHaveValue('SP')
  })

  it('cep nao encontrado avisa e libera preenchimento manual', async () => {
    server.use(http.get('https://viacep.com.br/ws/:cep/json/', () => HttpResponse.json({ erro: true })))
    seedLoggedInStorage()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    fireEvent.change(await screen.findByLabelText('CEP'), { target: { value: '99999999' } })

    expect(await screen.findByText(/cep não encontrado/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Rua')).not.toBeDisabled()
  })

  it('deep link em /enderecos sem sessao volta para /entrar', () => {
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
  })

  it('editar um endereco salva e atualiza a lista', async () => {
    seedLoggedInStorage()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    await fillAddress(casa)
    const list = await screen.findByRole('list', { name: /endereços salvos/i })

    fireEvent.click(within(list).getByRole('button', { name: /editar/i }))
    fireEvent.change(screen.getByLabelText('Rua'), { target: { value: 'Rua Nova' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar altera/i }))

    expect(await within(list).findByText(/rua nova, 45/i)).toBeInTheDocument()
  })

  it('definir padrao troca o selo entre enderecos', async () => {
    seedLoggedInStorage()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    await fillAddress(casa)
    await screen.findByRole('list', { name: /endereços salvos/i })
    await fillAddress({ ...casa, label: 'Trabalho', street: 'Rua Comercial', number: '10' })
    await screen.findByText('Trabalho')

    const list = screen.getByRole('list', { name: /endereços salvos/i })
    const items = within(list).getAllByRole('listitem')
    const trabalhoItem = items.find((item) => within(item).queryByText('Trabalho'))
    expect(trabalhoItem).toBeTruthy()

    fireEvent.click(within(trabalhoItem as HTMLElement).getByRole('button', { name: /tornar padrão/i }))

    await within(trabalhoItem as HTMLElement).findByText(/^padrão$/i)
    const casaItem = items.find((item) => within(item).queryByText('Casa'))
    expect(within(casaItem as HTMLElement).queryByText(/^padrão$/i)).not.toBeInTheDocument()
  })

  it('cep valido preenche o bairro automaticamente (autofill ViaCEP)', async () => {
    server.use(
      http.get('https://viacep.com.br/ws/:cep/json/', () =>
        HttpResponse.json({
          logradouro: 'Avenida Paulista',
          bairro: 'Bela Vista',
          localidade: 'São Paulo',
          uf: 'SP',
        }),
      ),
    )
    seedLoggedInStorage()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    fireEvent.change(await screen.findByLabelText('CEP'), { target: { value: '01310100' } })

    expect(await screen.findByLabelText('Bairro')).toHaveValue('Bela Vista')
  })

  it('selecionar "Outro" no nome do endereco libera texto livre, salvo como label', async () => {
    seedLoggedInStorage()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    fireEvent.change(await screen.findByLabelText('CEP'), { target: { value: '12345678' } })
    fireEvent.change(screen.getByLabelText('Nome do endereço'), { target: { value: 'Outro' } })

    const freeLabel = await screen.findByLabelText('Nome do endereço (outro)')
    fireEvent.change(freeLabel, { target: { value: 'Sítio' } })
    fireEvent.change(screen.getByLabelText('Rua'), { target: { value: 'Estrada Velha' } })
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Interior' } })
    fireEvent.change(screen.getByLabelText('Estado (UF)'), { target: { value: 'SP' } })
    fireEvent.change(screen.getByLabelText('Número'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar endereço/i }))

    const list = await screen.findByRole('list', { name: /endereços salvos/i })
    expect(within(list).getByText('Sítio')).toBeInTheDocument()
  })

  it('excluir com dois cliques remove o endereco da lista', async () => {
    seedLoggedInStorage()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    await fillAddress(casa)
    const list = await screen.findByRole('list', { name: /endereços salvos/i })

    const deleteButton = within(list).getByRole('button', { name: /^excluir$/i })
    fireEvent.click(deleteButton)
    expect(screen.getByRole('button', { name: /confirmar exclusão/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /confirmar exclusão/i }))

    expect(await screen.findByText(/nenhum endereço salvo/i)).toBeInTheDocument()
  })
})
