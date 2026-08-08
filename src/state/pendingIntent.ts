/**
 * Intenção pendente de retomada pós-login.
 *
 * Guardada em estado React (não em storage) por `useSessionState` — a
 * navegação para `/entrar` é client-side via wouter, então o estado do
 * componente sobrevive à transição. Um reload manual em `/entrar` perde essa
 * informação (degradação aceitável: o carrinho em si persiste — ver Task 5 —,
 * só a conveniência de retomar automaticamente se perde).
 */
export type PendingIntent =
  | { type: 'favorite'; productId: string }
  | { type: 'resume-checkout' }

/** Mensagem de contexto exibida na tela de login, conforme o gatilho. */
export const pendingIntentMessage = (intent: PendingIntent | null): string => {
  if (!intent) return ''
  if (intent.type === 'favorite') return 'Faça login para favoritar este produto.'
  return 'Faça login para continuar sua compra.'
}

// ---------------------------------------------------------------------------
// Persistência através de um reload de verdade
// ---------------------------------------------------------------------------

const PENDING_LOGIN_KEY = 'primeiroaqui_pending_login'

interface StoredPendingLogin {
  returnTo: string | null
  intent: PendingIntent | null
}

const isStoredPendingLogin = (value: unknown): value is StoredPendingLogin =>
  !!value && typeof value === 'object'

const getSessionStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    // Aba privada ou storage bloqueado por política: segue sem persistir.
    return null
  }
}

/**
 * Persiste `pendingReturnTo`/`pendingIntent` antes de uma navegação dura
 * (`hardNavigate`) no pós-login: o estado em memória do React não sobrevive
 * a um reload de verdade, então o destino/intenção viaja pelo
 * `sessionStorage` (não `localStorage` — não deve sobreviver além da aba/
 * sessão de navegação atual) só até o próximo mount consumi-lo.
 */
export const savePendingLogin = (returnTo: string | null, intent: PendingIntent | null): void => {
  const storage = getSessionStorage()
  if (!storage) return

  if (returnTo === null && intent === null) {
    storage.removeItem(PENDING_LOGIN_KEY)
    return
  }

  try {
    storage.setItem(PENDING_LOGIN_KEY, JSON.stringify({ returnTo, intent } satisfies StoredPendingLogin))
  } catch {
    // Silencioso de propósito: persistência é bônus, nunca pode derrubar o fluxo.
  }
}

/**
 * Lê e imediatamente apaga (consome) a intenção pendente gravada por
 * `savePendingLogin` — se aplica uma única vez, no primeiro mount depois do
 * reload; um F5 manual subsequente não deve reaplicar nada.
 */
export const consumePendingLogin = (): StoredPendingLogin => {
  const storage = getSessionStorage()
  if (!storage) return { returnTo: null, intent: null }

  const raw = storage.getItem(PENDING_LOGIN_KEY)
  if (!raw) return { returnTo: null, intent: null }
  storage.removeItem(PENDING_LOGIN_KEY)

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredPendingLogin(parsed)) return { returnTo: null, intent: null }
    return { returnTo: parsed.returnTo ?? null, intent: parsed.intent ?? null }
  } catch {
    return { returnTo: null, intent: null }
  }
}
