import { Award, Percent, ShoppingCart, Store, Ticket, Users } from 'lucide-react'
import { shortcuts } from '../data/catalog.js'

/** Ícones SVG do Lucide — nunca emoji como ícone estrutural. */
const icons = {
  percent: Percent,
  ticket: Ticket,
  award: Award,
  users: Users,
  store: Store,
  cart: ShoppingCart,
}

/** Trilho de atalhos circulares para serviços (ofertas, cupons, pontos...). */
export default function ShortcutRail({ onSelect }) {
  return (
    <nav aria-label="Atalhos de serviços" className="pt-4">
      <ul className="rail no-scrollbar px-3">
        {shortcuts.map((item) => {
          const Icon = icons[item.icon]
          return (
            <li key={item.id} className="w-[4.5rem]">
              <button
                type="button"
                onClick={() => onSelect?.(item)}
                className="flex w-full flex-col items-center gap-1.5 pb-1 pt-2
                           transition-transform duration-150 motion-safe:active:scale-95"
              >
                <span className="relative grid h-14 w-14 place-items-center rounded-full bg-surface shadow-card">
                  <Icon className="h-6 w-6 text-ink" aria-hidden="true" />
                  {item.tag && (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-1 whitespace-nowrap rounded-full bg-ship px-1.5
                                 py-0.5 text-[0.5625rem] font-extrabold uppercase leading-none text-white"
                    >
                      {item.tag}
                    </span>
                  )}
                </span>
                <span className="text-center text-micro font-semibold leading-tight text-ink">
                  {item.label}
                  {item.tag && <span className="sr-only"> — {item.tag}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
