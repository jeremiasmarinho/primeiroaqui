import { Home, LayoutGrid, Menu, PlaySquare, ShoppingCart } from 'lucide-react'

/**
 * Navegação inferior — máximo 5 itens, ícone + rótulo sempre visível
 * (Material Design: ícone sozinho prejudica descoberta).
 *
 * Fixed com safe-bottom; a página reserva `pb-nav` para o conteúdo não ficar
 * escondido atrás da barra.
 */
const items = [
  { id: 'home', label: 'Início', Icon: Home },
  { id: 'categories', label: 'Categorias', Icon: LayoutGrid },
  { id: 'cart', label: 'Carrinho', Icon: ShoppingCart },
  { id: 'videos', label: 'Vídeos', Icon: PlaySquare },
  { id: 'more', label: 'Mais', Icon: Menu },
]

export default function BottomNav({ active = 'home', cartCount = 0, onNavigate }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-nav"
    >
      <ul className="mx-auto flex max-w-6xl">
        {items.map(({ id, label, Icon }) => {
          const isActive = active === id
          const badge = id === 'cart' ? cartCount : 0

          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onNavigate?.(id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={badge > 0 ? `${label} — ${badge} itens` : label}
                className={`flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5
                            transition-colors duration-150
                            ${isActive ? 'text-ink' : 'text-ink-faint hover:text-ink-muted'}`}
              >
                <span className="relative">
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={isActive ? 2.4 : 1.8}
                    aria-hidden="true"
                  />
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
                <span aria-hidden="true" className={`text-micro ${isActive ? 'font-extrabold' : 'font-semibold'}`}>
                  {label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
