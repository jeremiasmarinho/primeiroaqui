import { Bell, Camera, ChevronRight, MapPin, Search } from 'lucide-react'
import { categories } from '../data/catalog.js'

/**
 * Header amarelo fixo: avatar, busca, notificações, endereço e abas de categoria.
 *
 * `sticky top-0` + `safe-top` mantém o header fora do notch. O conteúdo abaixo
 * não precisa de padding compensatório porque sticky (ao contrário de fixed)
 * ocupa espaço no fluxo.
 */
export default function TopBar({
  searchQuery,
  onSearchChange,
  searchRef,
  category,
  onCategoryChange,
  address = 'Avenida Guanabara, 148',
  userInitials = 'PA',
  userName,
  notificationCount = 0,
  onProfile,
  onNotifications,
}) {
  return (
    <header className="safe-top sticky top-0 z-40 bg-brand">
      <div className="mx-auto max-w-6xl px-3 pb-2 pt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onProfile}
            aria-label={`Abrir perfil de ${userName || 'convidado'}`}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface
                       text-sm font-extrabold text-ink shadow-card"
          >
            {userInitials}
          </button>

          <div className="relative flex-1">
            <label htmlFor="busca-global" className="sr-only">
              Buscar produtos, lojas ou categorias
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              id="busca-global"
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar no Primeiro Aqui"
              enterKeyHint="search"
              className="h-11 w-full rounded-full border-0 bg-surface pl-9 pr-11 text-sm
                         text-ink shadow-card outline-none placeholder:text-ink-faint"
            />
            <button
              type="button"
              aria-label="Buscar por foto"
              className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center
                         rounded-full text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={onNotifications}
            aria-label={`Notificações${notificationCount ? `, ${notificationCount} não lidas` : ''}`}
            className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink
                       transition-colors duration-150 hover:bg-brand-deep"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            {notificationCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full
                           bg-promo px-1 text-[0.625rem] font-bold leading-none text-white"
              >
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          className="mt-1.5 flex min-h-[36px] items-center gap-1 text-xs text-ink"
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="truncate">Enviar para {address}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Categorias" className="border-t border-ink/10">
        <ul className="rail no-scrollbar mx-auto max-w-6xl px-3">
          {categories.map((item) => {
            const active = category === item
            return (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => onCategoryChange(item)}
                  aria-current={active ? 'true' : undefined}
                  className={`relative min-h-[44px] px-1 text-sm transition-colors duration-150
                              ${active ? 'font-extrabold text-ink' : 'font-semibold text-ink/70'}`}
                >
                  {item}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-ink"
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </header>
  )
}
