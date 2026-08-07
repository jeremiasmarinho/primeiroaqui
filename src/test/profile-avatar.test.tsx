import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { vi } from 'vitest'
import { enterAsClient } from './authTestHelpers'
import { api, ApiError, type ApiUser } from '../lib/api'

/**
 * Foto de perfil: trocar (upload feliz), rejeitar tipo inválido e remover.
 *
 * `api.uploadAvatar`/`api.removeAvatar` são mockados diretamente (em vez de
 * ir até o MSW via fetch real): `<input type="file">` simulado em
 * jsdom + fetch nativo do Node (undici) produz um `File` que as checagens
 * internas do undici não reconhecem ao montar o corpo multipart — uma
 * incompatibilidade de ambiente de teste, não do código do app (a rota real
 * é exercitada pelos testes de integração do servidor, ver
 * src/server/routes/me.test.ts). Os handlers MSW de POST/DELETE
 * /api/me/avatar continuam em src/test/mocks/handlers.ts para documentar o
 * shape esperado e cobrir qualquer chamada feita fora deste arquivo.
 */
describe('avatar de perfil', () => {
  const goToProfile = () => {
    const nav = screen.getByRole('navigation', { name: /navegação principal/i })
    fireEvent.click(within(nav).getByRole('link', { name: /^mais$/i }))
  }

  const jpegFile = (name = 'foto.jpg') => new File(['fake-image-bytes'], name, { type: 'image/jpeg' })

  const baseUser: ApiUser = {
    id: 'user-1',
    authUserId: 'auth-user-1',
    email: 'cliente@primeiroaqui.com',
    name: 'Cliente Primeiro Aqui',
    role: 'BUYER',
    avatarUrl: null,
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('upload feliz troca a foto exibida', async () => {
    vi.spyOn(api, 'uploadAvatar').mockResolvedValue({
      user: { ...baseUser, avatarUrl: 'https://example.com/avatar.jpg' },
    })
    enterAsClient()
    goToProfile()

    const input = screen.getByLabelText(/selecionar foto de perfil/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [jpegFile()] } })

    await waitFor(() => {
      expect(screen.getByAltText('Foto de perfil')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /remover foto/i })).toBeInTheDocument()
    expect(api.uploadAvatar).toHaveBeenCalledTimes(1)
  })

  it('tipo de arquivo invalido mostra erro sem round-trip ao servidor e nao troca a foto', async () => {
    // Validação agora acontece no cliente antes de chamar a API: feedback
    // imediato em vez de esperar a rejeição do servidor (régua ML item 4).
    const uploadSpy = vi.spyOn(api, 'uploadAvatar').mockRejectedValue(
      new ApiError('Tipo de arquivo nao suportado: text/plain', 400),
    )
    enterAsClient()
    goToProfile()

    const input = screen.getByLabelText(/selecionar foto de perfil/i) as HTMLInputElement
    const badFile = new File(['nao e imagem'], 'arquivo.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [badFile] } })

    await waitFor(() => {
      expect(screen.getByText(/formato não suportado/i)).toBeInTheDocument()
    })
    expect(screen.queryByAltText('Foto de perfil')).not.toBeInTheDocument()
    expect(uploadSpy).not.toHaveBeenCalled()
  })

  it('remover foto volta a mostrar iniciais', async () => {
    vi.spyOn(api, 'uploadAvatar').mockResolvedValue({
      user: { ...baseUser, avatarUrl: 'https://example.com/avatar.jpg' },
    })
    vi.spyOn(api, 'removeAvatar').mockResolvedValue({ user: { ...baseUser, avatarUrl: null } })
    enterAsClient()
    goToProfile()

    const input = screen.getByLabelText(/selecionar foto de perfil/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [jpegFile()] } })
    await waitFor(() => {
      expect(screen.getByAltText('Foto de perfil')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /remover foto/i }))

    await waitFor(() => {
      expect(screen.queryByAltText('Foto de perfil')).not.toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /remover foto/i })).not.toBeInTheDocument()
    expect(api.removeAvatar).toHaveBeenCalledTimes(1)
  })
})
