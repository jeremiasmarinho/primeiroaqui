import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { enterAsClient } from './authTestHelpers'
import { db } from './mocks/handlers'

/**
 * Editar perfil (Item 3): nome, telefone e CPF, com validação client-side,
 * estado de pendente e toast. Passa pelo MSW real (não mocka `api.updateMe`)
 * porque, ao contrário do upload de avatar, o corpo é JSON puro — sem a
 * incompatibilidade de FormData/undici que afeta profile-avatar.test.tsx.
 */
describe('editar perfil', () => {
  const goToProfile = async () => {
    const nav = screen.getByRole('navigation', { name: /navegação principal/i })
    fireEvent.click(within(nav).getByRole('link', { name: /^mais$/i }))
    await screen.findByRole('button', { name: /editar perfil/i })
  }

  const openEditForm = async () => {
    await goToProfile()
    fireEvent.click(screen.getByRole('button', { name: /editar perfil/i }))
    await screen.findByLabelText(/^nome$/i)
  }

  it('salva nome, telefone e CPF válidos, mostra toast e atualiza a tela', async () => {
    enterAsClient()
    await openEditForm()

    fireEvent.change(screen.getByLabelText(/^nome$/i), { target: { value: 'Ana Editada' } })
    fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: '31999998888' } })
    fireEvent.change(screen.getByLabelText(/cpf/i), { target: { value: '11144477735' } })
    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => {
      expect(screen.getByText(/perfil atualizado/i)).toBeInTheDocument()
    })
    // Formulário fecha e volta para a visão de leitura, já com os dados novos.
    expect(screen.getByText('Ana Editada')).toBeInTheDocument()
    expect(screen.getByText('(31) 99999-8888')).toBeInTheDocument()
    expect(screen.getByText('111.444.777-35')).toBeInTheDocument()
    expect(db.user.phone).toBe('(31) 99999-8888')
    expect(db.user.document).toBe('111.444.777-35')
  })

  it('CPF inválido mostra erro no campo e não chama a API', async () => {
    enterAsClient()
    await openEditForm()

    fireEvent.change(screen.getByLabelText(/cpf/i), { target: { value: '11144477736' } })
    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }))

    expect(await screen.findByText(/cpf inválido/i)).toBeInTheDocument()
    expect(db.user.document).toBeNull()
  })

  it('telefone inválido mostra erro no campo', async () => {
    enterAsClient()
    await openEditForm()

    fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }))

    expect(await screen.findByText(/telefone inválido/i)).toBeInTheDocument()
  })

  it('nome vazio mostra erro no campo', async () => {
    enterAsClient()
    await openEditForm()

    fireEvent.change(screen.getByLabelText(/^nome$/i), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }))

    expect(await screen.findByText(/nome não pode ser vazio/i)).toBeInTheDocument()
  })

  it('cancelar fecha o formulário sem salvar', async () => {
    enterAsClient()
    await openEditForm()

    fireEvent.change(screen.getByLabelText(/^nome$/i), { target: { value: 'Nome Descartado' } })
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(screen.queryByLabelText(/^nome$/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Nome Descartado')).not.toBeInTheDocument()
  })
})
