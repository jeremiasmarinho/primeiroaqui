import { Link } from 'wouter'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  Icon: LucideIcon
  title: string
  message: string
  actionLabel: string
  actionHref: string
}

/**
 * Estado vazio com saída obrigatória.
 *
 * Regra 3 da Fase 2: estado vazio sem ação de saída é bug — deixa a pessoa
 * presa numa tela sem caminho. Por isso `actionLabel` e `actionHref` não são
 * opcionais.
 */
export default function EmptyState({
  Icon,
  title,
  message,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 py-10">
      <div className="w-full max-w-sm rounded-card bg-surface p-8 text-center shadow-card">
        <Icon className="mx-auto h-10 w-10 text-ink-faint" aria-hidden="true" />
        <h1 className="mt-3 font-display text-lg font-bold text-ink">{title}</h1>
        <p className="mt-1 text-sm leading-6 text-ink-muted">{message}</p>
        <Link
          href={actionHref}
          className="btn-primary min-h-[44px] mt-5 motion-safe:active:scale-95"
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  )
}
