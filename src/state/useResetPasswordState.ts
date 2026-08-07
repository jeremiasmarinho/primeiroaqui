import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'

/**
 * Estado da tela `/redefinir-senha`.
 *
 * O Supabase manda o link de recuperação com os tokens no FRAGMENTO da URL
 * (`#access_token=...&refresh_token=...&type=recovery`) — nunca na query
 * string, porque fragmento não é enviado ao servidor (evita vazar o token em
 * logs de acesso). Por isso os tokens são lidos de `window.location.hash` em
 * vez de vir de props de rota.
 */
export function useResetPasswordState(onSuccess: () => void) {
  const [tokens, setTokens] = useState<{ accessToken: string; refreshToken: string } | null>(null)
  const [linkError, setLinkError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (!accessToken || !refreshToken) {
      setLinkError('Link de redefinição inválido ou incompleto. Solicite um novo e-mail.')
      return
    }
    setTokens({ accessToken, refreshToken })
    // Roda uma única vez, na montagem da tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!tokens) return

    if (password.length < 8) {
      setFormError('Senha deve ter ao menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setFormError('As senhas não coincidem.')
      return
    }

    setFormError('')
    setPending(true)
    try {
      await api.resetPassword({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        password,
      })
      onSuccess()
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível redefinir sua senha. Tente novamente.',
      )
    } finally {
      setPending(false)
    }
  }

  return {
    linkError,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    formError,
    pending,
    handleSubmit,
  }
}
