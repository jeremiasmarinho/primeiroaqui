import { useEffect, useState } from 'react'

import { ROUTES } from '../router/routes'
import type { AuthForm } from '../screens/LoginScreen'
import { readStoredJSON } from '../lib/storage'
import { api, ApiError, loadStoredSession, storeSession, type ApiUser } from '../lib/api'
import { STORAGE_KEYS } from './session'
import { EMAIL_REGEX, normalizeStoredUser } from './marketplaceSeed'
import type { PendingIntent } from './pendingIntent'
import type { Role, User } from '../types'

/** ApiUser → User da UI. O papel vem SEMPRE do servidor, nunca do storage. */
const toViewUser = (dto: ApiUser): User => ({
  id: dto.id,
  name: dto.name,
  email: dto.email,
  role: dto.role,
  avatarUrl: dto.avatarUrl,
})

/**
 * Sessão real contra /api/auth/*.
 *
 * `handleAuthSubmit` valida o mínimo localmente (formato de e-mail, tamanho
 * de senha — espelho das regras do zod do servidor) e chama a API; a mensagem
 * de erro exibida vem do body pt-BR do backend quando houver. Signup faz
 * signup + login em sequência: o POST /auth/signup não devolve sessão.
 *
 * Na inicialização, uma sessão persistida é revalidada com GET /api/me — é a
 * resposta do servidor que confirma o papel (BUYER/STORE_OWNER/ADMIN); o
 * papel gravado no localStorage nunca eleva privilégio (regressão B5).
 */
export function useSessionState(
  navigate: (path: string) => void,
  onBeforeRedirect?: () => void,
) {
  const storedUser = normalizeStoredUser(readStoredJSON<unknown>(STORAGE_KEYS.user, null))

  const [userRole, setUserRole] = useState<Role>(() => storedUser?.role ?? 'BUYER')
  const [authUser, setAuthUser] = useState<User | null>(storedUser)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authForm, setAuthForm] = useState<AuthForm>({ email: '', password: '', name: '' })
  const [authError, setAuthError] = useState('')
  const [authPending, setAuthPending] = useState(false)
  const [pendingReturnTo, setPendingReturnTo] = useState<string | null>(null)
  const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(null)

  // "Esqueci minha senha": um mini-formulário dentro da tela de login.
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotStatus, setForgotStatus] = useState<'idle' | 'pending' | 'sent'>('idle')
  const [forgotError, setForgotError] = useState('')
  // Aviso mostrado no login após voltar de /redefinir-senha com sucesso.
  const [resetSuccessMessage, setResetSuccessMessage] = useState('')

  const isDevMode = import.meta.env.DEV

  // Revalidação da sessão persistida: com token salvo, o /me confirma quem é
  // e qual o papel real. Um 401 aqui já derruba o storage via api.ts; o
  // estado em memória cai pelo onUnauthorized registrado no orquestrador.
  useEffect(() => {
    if (!loadStoredSession()) return
    let cancelled = false
    api
      .me()
      .then(({ user }) => {
        if (cancelled) return
        setAuthUser(toViewUser(user))
        setUserRole(user.role)
      })
      .catch(() => {
        // 401 é tratado globalmente (onUnauthorized); falha de rede mantém a
        // sessão local — melhor otimista do que deslogar porque o wi-fi piscou.
      })
    return () => {
      cancelled = true
    }
    // Roda uma única vez, na montagem do app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Guarda de rota protegida: só registra o destino — quem navega é o AppRouter (via <Redirect>). */
  const recordReturnTo = (path: string) => {
    setPendingReturnTo(path)
    setPendingIntent(null)
  }

  /**
   * Gatilho contextual (favoritar, checkout): registra e navega para /entrar.
   * Antes de navegar, fecha qualquer overlay aberto (ex.: gaveta do carrinho)
   * via `onBeforeRedirect` — o backdrop fixo da gaveta, se deixado aberto,
   * fica por cima do formulário de login e bloqueia o clique (browser real;
   * testes com fireEvent não pegam isso). `useSessionState` não conhece o
   * hook do carrinho diretamente (fatias de estado separadas por design),
   * então quem instancia este hook injeta esse callback.
   */
  const redirectToLogin = (path: string, intent: PendingIntent | null = null) => {
    onBeforeRedirect?.()
    setPendingReturnTo(path)
    setPendingIntent(intent)
    navigate(ROUTES.login)
  }

  const clearPendingLogin = () => {
    setPendingReturnTo(null)
    setPendingIntent(null)
  }

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<boolean> => {
    event.preventDefault()

    if (!EMAIL_REGEX.test(authForm.email)) {
      setAuthError('Informe um e-mail valido.')
      return false
    }
    // Espelho do zod do servidor: signup exige 8+; no login basta não ser vazia,
    // mas mantemos o piso de 6 herdado da fase mock para dar erro cedo.
    if (authForm.password.length < (authMode === 'signup' ? 8 : 6)) {
      setAuthError(
        authMode === 'signup'
          ? 'Senha deve ter ao menos 8 caracteres.'
          : 'Senha deve ter ao menos 6 caracteres.',
      )
      return false
    }
    if (authMode === 'signup' && !authForm.name.trim()) {
      setAuthError('Informe seu nome.')
      return false
    }

    setAuthError('')
    setResetSuccessMessage('')
    setAuthPending(true)
    try {
      if (authMode === 'signup') {
        await api.signup({
          email: authForm.email,
          password: authForm.password,
          name: authForm.name.trim(),
        })
      }
      // Signup não devolve sessão — o login em sequência autentica de fato.
      const { session, user } = await api.login({
        email: authForm.email,
        password: authForm.password,
      })
      storeSession(session)
      setAuthUser(toViewUser(user))
      setUserRole(user.role)
      return true
    } catch (error) {
      setAuthError(
        error instanceof ApiError ? error.message : 'Não foi possível entrar. Tente novamente.',
      )
      return false
    } finally {
      setAuthPending(false)
    }
  }

  /**
   * Atalho de desenvolvimento: sessão local com token falso. O MSW dos testes
   * aceita qualquer Bearer; contra o servidor real qualquer chamada
   * autenticada devolve 401 e derruba a sessão — aceitável para um atalho que
   * não existe em produção.
   */
  const handleQuickLogin = (role: Role): void => {
    storeSession({ accessToken: 'dev-token', refreshToken: 'dev-refresh', expiresAt: undefined })
    setUserRole(role)
    setAuthUser({
      name: role === 'ADMIN' ? 'Operador' : 'Cliente',
      email: authForm.email || 'cliente@primeiroaqui.com',
      role,
    })
  }

  const openForgotPassword = () => {
    setForgotPasswordOpen(true)
    setForgotEmail(authForm.email)
    setForgotStatus('idle')
    setForgotError('')
  }

  const closeForgotPassword = () => {
    setForgotPasswordOpen(false)
    setForgotStatus('idle')
    setForgotError('')
  }

  /**
   * Sempre termina em "sent": o backend já responde 200 genérico mesmo para
   * e-mail inexistente (anti-enumeração — ver `auth.ts`), e uma falha de
   * rede aqui não deveria dar pista alguma sobre a conta, então a mensagem
   * de sucesso é mostrada de qualquer forma.
   */
  const handleForgotPasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!EMAIL_REGEX.test(forgotEmail)) {
      setForgotError('Informe um e-mail valido.')
      return
    }
    setForgotError('')
    setForgotStatus('pending')
    try {
      await api.forgotPassword(forgotEmail)
    } finally {
      setForgotStatus('sent')
    }
  }

  const notePasswordResetSuccess = () => {
    navigate(ROUTES.login)
    setResetSuccessMessage('Senha redefinida com sucesso. Entre com sua nova senha.')
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
    authPending,
    isDevMode,
    pendingReturnTo,
    pendingIntent,
    recordReturnTo,
    redirectToLogin,
    clearPendingLogin,
    handleAuthSubmit,
    handleQuickLogin,
    forgotPasswordOpen,
    forgotEmail,
    setForgotEmail,
    forgotStatus,
    forgotError,
    openForgotPassword,
    closeForgotPassword,
    handleForgotPasswordSubmit,
    resetSuccessMessage,
    notePasswordResetSuccess,
  }
}
