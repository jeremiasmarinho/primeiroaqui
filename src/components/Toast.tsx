import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'

import { useToasts, type ToastType } from '../state/useToasts'

const icons: Record<ToastType, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: TriangleAlert,
}

const tones: Record<ToastType, string> = {
  info: 'border-primary/20 bg-primary/10 text-primary',
  success: 'border-success/20 bg-success/10 text-success',
  error: 'border-error/20 bg-error/10 text-error',
}

/**
 * Pilha de toasts transitórios — feedback imediato de ações do comprador
 * (adicionar ao carrinho, favoritar, salvar endereço). Fica acima da
 * BottomNav (z-40) e some sozinho; a notificação persistente (sino) segue
 * vivendo em `NotificationsPanel`.
 *
 * `aria-live="polite"` para leitor de tela anunciar sem roubar foco —
 * nenhum botão aqui é focável por padrão.
 */
export default function ToastStack() {
  const { visibleToasts, dismissToast } = useToasts()

  if (visibleToasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="safe-bottom pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+0.75rem)] z-50
                 flex flex-col items-center gap-2 px-4"
    >
      {visibleToasts.map((toast) => {
        const Icon = icons[toast.type]
        return (
          <div
            key={toast.id}
            role="status"
            className={`motion-safe:animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-2
                        rounded-card border px-4 py-3 shadow-raised backdrop-blur-sm ${tones[toast.type]}
                        motion-reduce:animate-none motion-reduce:transition-opacity`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm font-semibold text-ink">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Fechar aviso"
              className="motion-safe:active:scale-95 shrink-0 text-ink-faint transition-transform hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
