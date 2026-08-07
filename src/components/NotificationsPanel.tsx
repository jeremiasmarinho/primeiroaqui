import { BellOff, CheckCircle2, ChevronRight, Info, TriangleAlert } from 'lucide-react'
import { Link } from 'wouter'
import type { Notification } from '../types'

const icons: Record<Notification['type'], typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
}

const tones: Record<Notification['type'], string> = {
  info: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
}

interface NotificationsPanelProps {
  notifications: Notification[]
  onClose: () => void
}

/** Painel de notificações reais (checkout, cadastro de loja, erros de ação) — sem mock. */
export default function NotificationsPanel({ notifications, onClose }: NotificationsPanelProps) {
  return (
    <div
      role="dialog"
      aria-label="Notificações"
      className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(22rem,calc(100vw-1.5rem))]
                 overflow-hidden rounded-card bg-surface shadow-raised"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-display text-sm font-bold text-ink">Notificações</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-ink-muted hover:text-ink"
        >
          Fechar
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <BellOff className="h-6 w-6 text-ink-faint" aria-hidden="true" />
          <p className="text-sm text-ink-muted">Nenhuma notificação por aqui ainda.</p>
        </div>
      ) : (
        <ul className="max-h-80 divide-y divide-line overflow-y-auto">
          {notifications.map((notification) => {
            const Icon = icons[notification.type]
            const body = (
              <>
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tones[notification.type]}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{notification.title}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">{notification.message}</p>
                </div>
              </>
            )
            return (
              <li key={notification.id}>
                {notification.href ? (
                  // Notificação com destino é link de verdade: navega e fecha o painel.
                  <Link
                    href={notification.href}
                    onClick={onClose}
                    className="flex gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-sunken"
                  >
                    {body}
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
                  </Link>
                ) : (
                  <div className="flex gap-3 px-4 py-3">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
