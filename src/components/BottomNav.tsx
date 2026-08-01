import { Home, LayoutGrid, Menu, PlaySquare, ShoppingCart } from 'lucide-react'
import { Link } from 'wouter'
import { ROUTES } from '../router/routes'

export type NavId = 'home' | 'categories' | 'cart' | 'videos' | 'more'

/**
 * Navegação inferior — máximo 5 itens, ícone + rótulo sempre visível
 * (Material Design: ícone sozinho prejudica descoberta).
 *
 * Os destinos que são telas viram `<Link>` de verdade: alcançáveis por teclado,
 * abrem em nova aba com ctrl+clique e entram no histórico. O carrinho continua
 * botão porque abre uma gaveta sobre a tela atual — não navega.
 *
 * Fixed com safe-bottom; a página reserva `pb-nav` para o conteúdo não ficar
 * escondido atrás da barra.
 */
interface BottomNavProps {
  active?: NavId
  cartCount?: number
  /** Destino do item "Mais". Operação vai ao painel; cliente, ao perfil. */
  moreHref?: string
  onNavigate?: (id: NavId) => void
}

export default function BottomNav({
  active = 'home',
  cartCount = 0,
  moreHref = ROUTES.profile,
  onNavigate,
}: BottomNavProps) {
  const items: {
    id: NavId
    label: string
    Icon: typeof Home
    href?: string
  }[] = [
    { id: 'home', label: 'Início', Icon: Home, href: ROUTES.home },
    { id: 'categories', label: 'Categorias', Icon: LayoutGrid, href: ROUTES.categories },
    { id: 'cart', label: 'Carrinho', Icon: ShoppingCart },
    { id: 'videos', label: 'Vídeos', Icon: PlaySquare },
    { id: 'more', label: 'Mais', Icon: Menu, href: moreHref },
  ]

  return (
    <nav
      aria-label="Navegação principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-nav"
    >
      <ul className="mx-auto flex max-w-6xl">
        {items.map(({ id, label, Icon, href }) => {
          const isActive = active === id
          const badge = id === 'cart' ? cartCount : 0
          const accessibleName = badge > 0 ? `${label} — ${badge} itens` : label

          const className = `flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5
                             transition-colors duration-150
                             ${isActive ? 'text-ink' : 'text-ink-faint hover:text-ink-muted'}`

          const content = (
            <>
              <span className="relative">
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 1.8} aria-hidden="true" />
                {badge > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center
                               rounded-full bg-promo px-1 text-[0.625rem] font-bold leading-none text-white"
                  >
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              <span
                aria-hidden="true"
                className={`text-micro ${isActive ? 'font-extrabold' : 'font-semibold'}`}
              >
                {label}
              </span>
            </>
          )

          return (
            <li key={id} className="flex-1">
              {href ? (
                <Link
                  href={href}
                  aria-label={accessibleName}
                  aria-current={isActive ? 'page' : undefined}
                  className={className}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate?.(id)}
                  aria-label={accessibleName}
                  aria-current={isActive ? 'page' : undefined}
                  className={className}
                >
                  {content}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
