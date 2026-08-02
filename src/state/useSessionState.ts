import { useState } from 'react'

import { ROUTES } from '../router/routes'
import type { AuthForm } from '../screens/LoginScreen'
import { readStoredJSON } from '../lib/storage'
import { STORAGE_KEYS } from './session'
import { EMAIL_REGEX, normalizeStoredUser } from './marketplaceSeed'
import type { PendingIntent } from './pendingIntent'
import type { Role, User } from '../types'

/**
 * Sessão: usuário autenticado, papel, formulário de login/cadastro, e a
 * intenção pendente de retomada (`src/state/pendingIntent.ts`).
 *
 * `handleAuthSubmit`/`handleQuickLogin` não navegam mais sozinhos — devolvem
 * se o login deu certo (ou sempre dão certo, no atalho de dev) e quem chama
 * (`useMarketplaceState`) decide para onde ir, porque só ele sabe resolver a
 * intenção pendente (favoritar, retomar checkout), que mora em outros hooks.
 */
export function useSessionState(navigate: (path: string) => void) {
  const storedUser = normalizeStoredUser(readStoredJSON<unknown>(STORAGE_KEYS.user, null))

  const [userRole, setUserRole] = useState<Role>(() => storedUser?.role ?? 'client')
  const [authUser, setAuthUser] = useState<User | null>(storedUser)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authForm, setAuthForm] = useState<AuthForm>({ email: '', password: '', name: '' })
  const [authError, setAuthError] = useState('')
  const [pendingReturnTo, setPendingReturnTo] = useState<string | null>(null)
  const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(null)

  const isDevMode = import.meta.env.DEV

  /** Guarda de rota protegida: só registra o destino — quem navega é o AppRouter (via <Redirect>). */
  const recordReturnTo = (path: string) => {
    setPendingReturnTo(path)
    setPendingIntent(null)
  }

  /** Gatilho contextual (favoritar, checkout): registra e navega para /entrar. */
  const redirectToLogin = (path: string, intent: PendingIntent | null = null) => {
    setPendingReturnTo(path)
    setPendingIntent(intent)
    navigate(ROUTES.login)
  }

  const clearPendingLogin = () => {
    setPendingReturnTo(null)
    setPendingIntent(null)
  }

  const handleAuthSubmit = (event: React.FormEvent<HTMLFormElement>): boolean => {
    event.preventDefault()

    if (!EMAIL_REGEX.test(authForm.email)) {
      setAuthError('Informe um e-mail valido.')
      return false
    }
    if (authForm.password.length < 6) {
      setAuthError('Senha deve ter ao menos 6 caracteres.')
      return false
    }

    setAuthError('')
    setAuthUser({
      name: authForm.name || 'Cliente Primeiro Aqui',
      email: authForm.email,
      role: 'client',
    })
    setUserRole('client')
    return true
  }

  const handleQuickLogin = (role: Role): void => {
    setUserRole(role)
    setAuthUser({
      name: role === 'admin' ? 'Operador' : 'Cliente',
      email: authForm.email || 'cliente@primeiroaqui.com',
      role,
    })
  }

  return {
    authUser,
    setAuthUser,
    userRole,
    setUserRole,
    authMode,
    setAuthMode,
    authForm,
    setAuthForm,
    authError,
    isDevMode,
    pendingReturnTo,
    pendingIntent,
    recordReturnTo,
    redirectToLogin,
    clearPendingLogin,
    handleAuthSubmit,
    handleQuickLogin,
  }
}
