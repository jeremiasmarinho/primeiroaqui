import { ArrowLeft, type LucideIcon } from 'lucide-react'
import { Link } from 'wouter'

import { ROUTES } from '../router/routes'

/**
 * Peças comuns das telas de conta (favoritos, pedidos, endereços).
 *
 * Regra 3 da Fase 2: toda tela nasce com estado vazio, de carregamento e de
 * erro — e estado vazio sem ação de saída é bug. Concentrar os três aqui evita
 * que uma tela nova esqueça um deles.
 */

/** Rótulo de contagem em português, sem "1 itens". */
export const itemsLabel = (count: number): string =>
  count === 1 ? '1 item' : `${count} itens`

interface ScreenHeaderProps {
  title: string
  count?: string
}

export function ScreenHeader({ title, count }: ScreenHeaderProps) {
  return (
    <header className="safe-top sticky top-0 z-30 flex items-center gap-2 bg-brand px-3 py-2">
      <Link
        href={ROUTES.home}
        aria-label="Voltar às ofertas"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink
                   transition-colors duration-150 hover:bg-brand-deep"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </Link>
      <h1 className="text-sm font-bold text-ink">{title}</h1>
      {count ? <span className="ml-auto text-micro font-bold text-ink/70">{count}</span> : null}
    </header>
  )
}

/** Link de saída padrão. Nome distinto do "voltar" do cabeçalho, senão a
 *  mesma tela passa a ter dois controles com o mesmo nome acessível. */
export function ExitLink() {
  return (
    <Link
      href={ROUTES.home}
      className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-ink px-5 text-sm
                 font-bold text-white transition-transform duration-150 motion-safe:active:scale-95"
    >
      Explorar ofertas
    </Link>
  )
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="rounded-card bg-surface p-8 text-center text-sm text-ink-muted shadow-card"
    >
      {label}
    </div>
  )
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-card bg-surface p-8 text-center shadow-card">
      <p role="alert" className="text-sm font-bold text-promo">
        {message}
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        Tente de novo em instantes. Suas informações continuam salvas.
      </p>
      <ExitLink />
    </div>
  )
}

interface EmptyBlockProps {
  Icon: LucideIcon
  title: string
  message: string
}

export function EmptyBlock({ Icon, title, message }: EmptyBlockProps) {
  return (
    <div className="rounded-card bg-surface p-8 text-center shadow-card">
      <Icon className="mx-auto h-10 w-10 text-ink-faint" aria-hidden="true" />
      <p className="mt-3 font-display text-base font-bold text-ink">{title}</p>
      <p className="mt-1 text-sm leading-6 text-ink-muted">{message}</p>
      <ExitLink />
    </div>
  )
}
