import { useState } from 'react'

import { ROUTES } from '../router/routes'
import type { AuthForm } from '../screens/LoginScreen'
import { readStoredJSON } from '../lib/storage'
import { STORAGE_KEYS } from './session'
import { EMAIL_REGEX, normalizeStoredUser } from './marketplaceSeed'
import type { Role, User } from '../types'

/** Sessão: usuário autenticado, papel e formulário de login/cadastro. */
export function useSessionState(navigate: (path: string) => void) {
  const storedUser = normalizeStoredUser(readStoredJSON<unknown>(STORAGE_KEYS.user, null))

  const [userRole, setUserRole] = useState<Role>(() => storedUser?.role ?? 'client')
  const [authUser, setAuthUser] = useState<User | null>(storedUser)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authForm, setAuthForm] = useState<AuthForm>({ email: '', password: '', name: '' })
  const [authError, setAuthError] = useState('')

  const isDevMode = import.meta.env.DEV

  const handleAuthSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!EMAIL_REGEX.test(authForm.email)) {
      setAuthError('Informe um e-mail valido.')
      return
    }
    if (authForm.password.length < 6) {
      setAuthError('Senha deve ter ao menos 6 caracteres.')
      return
    }

    setAuthError('')
    setAuthUser({
      name: authForm.name || 'Cliente Primeiro Aqui',
      email: authForm.email,
      role: 'client',
    })
    setUserRole('client')
    navigate(ROUTES.home)
  }

  const handleQuickLogin = (role: Role) => {
    setUserRole(role)
    setAuthUser({
      name: role === 'admin' ? 'Operador' : 'Cliente',
      email: authForm.email || 'cliente@primeiroaqui.com',
      role,
    })
    navigate(ROUTES.home)
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
    handleAuthSubmit,
    handleQuickLogin,
  }
}
