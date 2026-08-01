import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import MarketplaceApp from '../MarketplaceApp'
import AddressesScreen from '../screens/AddressesScreen'
import { ROUTES } from '../router/routes'
import { EMPTY_ADDRESS } from '../state/addresses'
import { STORAGE_KEYS } from '../state/session'
import { makeAddress } from './factories'

/** WU-48 — endereços: cadastro, padrão e uso no checkout. */
const goTo = (path: string) => {
  window.history.pushState({}, '', path)
}

const login = () => {
  localStorage.setItem(
    STORAGE_KEYS.user,
    JSON.stringify({ name: 'Ana Paula', email: 'ana@teste.com', role: 'client' }),
  )
}

const baseProps = {
  addresses: [],
  addressForm: EMPTY_ADDRESS,
  addressError: '',
  onAddressFormChange: vi.fn(),
  onAddressSubmit: vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
  onSetDefaultAddress: vi.fn(),
  onRemoveAddress: vi.fn(),
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
    expect(screen.getByLabelText('Rua e número')).toBeInTheDocument()
  })

  it('todo campo do formulario tem label associado', () => {
    const { container } = render(<AddressesScreen {...baseProps} />)

    container.querySelectorAll('input').forEach((input) => {
      expect(input.id, 'input sem id nao pode ser associado a label').toBeTruthy()
      expect(container.querySelector(`label[for="${input.id}"]`)).toBeTruthy()
    })
  })

  it('os controles de cada endereco respeitam o alvo minimo de toque', () => {
    render(<AddressesScreen {...baseProps} addresses={[makeAddress({ id: 'end-1' })]} />)

    const remove = screen.getByRole('button', { name: /remover endereço casa/i })
    const setDefault = screen.getByRole('button', { name: /definir casa como padrão/i })

    expect(remove.className).toMatch(/min-h-\[4[4-9]px\]|h-11|h-12/)
    expect(setDefault.className).toMatch(/min-h-\[4[4-9]px\]|h-11|h-12/)
  })

  it('o endereco padrao se anuncia e nao oferece o botao de definir padrao', () => {
    render(<AddressesScreen {...baseProps} addresses={[makeAddress({ id: 'end-1', isDefault: true })]} />)

    expect(screen.getByText(/padrão/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /definir casa como padrão/i })).not.toBeInTheDocument()
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

  const fillAddress = (values: {
    label: string
    street: string
    city: string
    cep: string
  }) => {
    fireEvent.change(screen.getByLabelText('Nome do endereço'), { target: { value: values.label } })
    fireEvent.change(screen.getByLabelText('Rua e número'), { target: { value: values.street } })
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: values.city } })
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: values.cep } })
    fireEvent.click(screen.getByRole('button', { name: /salvar endereço/i }))
  }

  const casa = { label: 'Casa', street: 'Rua das Flores, 45', city: 'Centro', cep: '12345678' }

  it('cadastra, mascara o cep e marca o primeiro endereco como padrao', () => {
    login()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    fillAddress(casa)

    const list = screen.getByRole('list', { name: /endereços salvos/i })
    expect(within(list).getByText(/rua das flores, 45/i)).toBeInTheDocument()
    expect(within(list).getByText('12345-678')).toBeInTheDocument()
    expect(within(list).getByText(/padrão/i)).toBeInTheDocument()
  })

  it('cep invalido e rejeitado com mensagem que ensina o formato', () => {
    login()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    fillAddress({ ...casa, cep: '123' })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/00000-000/)
    expect(screen.queryByRole('list', { name: /endereços salvos/i })).not.toBeInTheDocument()
  })

  it('definir padrao troca qual endereco o cabecalho anuncia', () => {
    login()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    fillAddress(casa)
    fillAddress({ label: 'Trabalho', street: 'Avenida Central, 900', city: 'Centro', cep: '87654321' })
    fireEvent.click(screen.getByRole('button', { name: /definir trabalho como padrão/i }))

    fireEvent.click(screen.getByRole('link', { name: /voltar às ofertas/i }))
    expect(screen.getByText(/enviar para avenida central, 900/i)).toBeInTheDocument()
  })

  it('o cabecalho deixa de mostrar endereco fixo quando ha padrao', () => {
    login()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    fillAddress(casa)
    fireEvent.click(screen.getByRole('link', { name: /voltar às ofertas/i }))

    expect(screen.getByText(/enviar para rua das flores, 45/i)).toBeInTheDocument()
    expect(screen.queryByText(/avenida guanabara, 148/i)).not.toBeInTheDocument()
  })

  it('o endereco escolhido no checkout entra no pedido finalizado', () => {
    login()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    fillAddress(casa)
    fillAddress({ label: 'Trabalho', street: 'Avenida Central, 900', city: 'Centro', cep: '87654321' })
    fireEvent.click(screen.getByRole('link', { name: /voltar às ofertas/i }))

    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    fireEvent.click(screen.getByRole('radio', { name: /trabalho/i }))
    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Ana' } })
    expect(screen.getByLabelText('Endereço')).toHaveValue('Avenida Central, 900')

    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))

    expect(window.location.pathname).toBe(ROUTES.order('1004'))
    expect(screen.getByText('Avenida Central, 900')).toBeInTheDocument()
  })

  it('o endereco padrao ja vem escolhido ao abrir a entrega', () => {
    login()
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    fillAddress(casa)
    fireEvent.click(screen.getByRole('link', { name: /voltar às ofertas/i }))

    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    expect(screen.getByRole('radio', { name: /casa/i })).toBeChecked()
    expect(screen.getByLabelText('Endereço')).toHaveValue('Rua das Flores, 45')
    expect(screen.getByLabelText('CEP')).toHaveValue('12345-678')
  })

  it('sem endereco salvo, o checkout convida a cadastrar em vez de fingir', () => {
    login()
    render(<MarketplaceApp />)

    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('link', { name: /cadastrar endereço/i })).toHaveAttribute(
      'href',
      ROUTES.addresses,
    )
  })

  it('cep invalido no checkout explica o formato esperado', () => {
    login()
    render(<MarketplaceApp />)

    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Endereço'), { target: { value: 'Rua 1' } })
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Centro' } })
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar compra/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/00000-000/)
  })

  it('o campo de cep do checkout aplica a mascara enquanto digita', () => {
    login()
    render(<MarketplaceApp />)

    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '12345678' } })
    expect(screen.getByLabelText('CEP')).toHaveValue('12345-678')
  })

  it('enderecos sobrevivem ao reload', () => {
    login()
    goTo(ROUTES.addresses)
    const first = render(<MarketplaceApp />)
    fillAddress(casa)
    first.unmount()

    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    expect(screen.getByText(/rua das flores, 45/i)).toBeInTheDocument()
  })

  it('deep link em /enderecos sem sessao volta para /entrar', () => {
    goTo(ROUTES.addresses)
    render(<MarketplaceApp />)

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
  })
})
