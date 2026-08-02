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
  | { type: 'favorite'; productId: number }
  | { type: 'resume-checkout' }

/** Mensagem de contexto exibida na tela de login, conforme o gatilho. */
export const pendingIntentMessage = (intent: PendingIntent | null): string => {
  if (!intent) return ''
  if (intent.type === 'favorite') return 'Faça login para favoritar este produto.'
  return 'Faça login para continuar sua compra.'
}
