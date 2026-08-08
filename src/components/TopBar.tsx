import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Bell, ChevronRight, LogIn, MapPin, Search } from 'lucide-react'
import { Link } from 'wouter'
import { ROUTES, toCategorySlug } from '../router/routes'
import { buildSearchSuggestions } from '../state/searchSuggestions'
import { useSearchHistory } from '../state/useSearchHistory'
import SearchSuggestions from './SearchSuggestions'
import NotificationsPanel from './NotificationsPanel'
import type { Category, Notification, Product } from '../types'

/**
 * Header amarelo fixo: avatar, busca, notificações, endereço e abas de categoria.
 *
 * `sticky top-0` + `safe-top` mantém o header fora do notch. O conteúdo abaixo
 * não precisa de padding compensatório porque sticky (ao contrário de fixed)
 * ocupa espaço no fluxo.
 */
interface TopBarProps {
  /** Catálogo carregado da API — alimenta sugestões de busca. */
  catalogProducts: Product[]
  /** Categorias reais derivadas do catálogo (inclui 'Tudo'). */
  categories: Category[]
  searchQuery: string
  onSearchChange: (value: string) => void
  searchRef?: React.RefObject<HTMLInputElement | null>
  category: Category
  onSearchSubmit?: (term: string) => void
  /** Endereço padrão da pessoa. Sem endereço salvo, mostra o convite genérico. */
  address?: string
  userInitials?: string
  userName?: string
  /** Foto de perfil; se ausente ou falhar ao carregar, mostra as iniciais. */
  userAvatarUrl?: string | null
  /** Notificações reais geradas por ações (checkout, cadastro de loja etc.). */
  notifications?: Notification[]
  notificationCount?: number
  /** Destino do avatar. Operação vai ao painel; cliente, ao perfil. */
  profileHref?: string
  /** Chamado quando o painel de notificações abre — zera o contador de não lidas. */
  onNotificationsOpen?: () => void
  /** Guest (sem sessão) mostra ícone de entrada em vez de iniciais. */
  isAuthenticated?: boolean
}

export default function TopBar({
  catalogProducts,
  categories,
  searchQuery,
  onSearchChange,
  searchRef,
  category,
  onSearchSubmit,
  address,
  userInitials = 'PA',
  userName,
  userAvatarUrl,
  notifications = [],
  notificationCount = 0,
  profileHref,
  onNotificationsOpen,
  isAuthenticated = true,
}: TopBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const focusFirstOptionRef = useRef(false)
  // Refoco programático (depois de aplicar sugestão ou apertar Escape) não
  // pode reabrir a lista — senão fechar vira reabrir na hora, e a pessoa
  // nunca sai do dropdown.
  const suppressFocusOpenRef = useRef(false)
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  // Falha ao carregar a foto (URL quebrada/removida) cai de volta para as
  // iniciais em vez de deixar um ícone de imagem quebrada no header.
  const [avatarFailed, setAvatarFailed] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const { history, addTerm, removeTerm, clear } = useSearchHistory()

  useEffect(() => {
    setAvatarFailed(false)
  }, [userAvatarUrl])

  const toggleNotifications = () => {
    // Efeito (marcar como lidas no estado do pai) fica FORA do updater: React
    // executa updaters durante o render, e chamar setState de outro
    // componente ali dispara o warning "Cannot update a component
    // (MarketplaceApp) while rendering a different component (TopBar)".
    const next = !isNotificationsOpen
    if (next) onNotificationsOpen?.()
    setIsNotificationsOpen(next)
  }

  useEffect(() => {
    if (!isNotificationsOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsNotificationsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape as unknown as EventListener)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape as unknown as EventListener)
    }
  }, [isNotificationsOpen])

  // Derivado do catálogo carregado — nada de rede, então recalcular a cada
  // tecla é barato. `useMemo` evita refazer o trabalho em re-renders que não
  // mudaram o termo digitado.
  const suggestions = useMemo(
    () => buildSearchSuggestions(searchQuery, { products: catalogProducts, categories, stores: [] }),
    [searchQuery, catalogProducts, categories],
  )

  const setInputRef = (node: HTMLInputElement | null) => {
    inputRef.current = node
    if (searchRef) {
      searchRef.current = node
    }
  }

  const commitSearch = (term: string) => {
    onSearchSubmit?.(term)
    if (term.trim()) addTerm(term)
    setIsSuggestionsOpen(false)
  }

  const focusInputWithoutReopening = () => {
    // `.focus()` num elemento já focado não dispara evento — só arma a
    // supressão quando o foco realmente vai se mover, senão a flag fica
    // pendurada e engole o próximo foco legítimo.
    if (document.activeElement !== inputRef.current) {
      suppressFocusOpenRef.current = true
    }
    inputRef.current?.focus()
  }

  const applySuggestion = (term: string) => {
    onSearchChange(term)
    commitSearch(term)
    focusInputWithoutReopening()
  }

  const closeSuggestions = () => {
    setIsSuggestionsOpen(false)
    focusInputWithoutReopening()
  }

  // A lista só existe no DOM depois que `isSuggestionsOpen` vira true e o
  // React comita o render — por isso ArrowDown não pode focar a primeira
  // opção na hora: se a lista já estiver aberta, o botão já existe e o foco
  // funciona direto; senão, marca a intenção e o efeito abaixo termina o
  // trabalho assim que a lista aparecer.
  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const firstOption = containerRef.current?.querySelector<HTMLButtonElement>(
        '[data-suggestion-option="true"]',
      )
      if (firstOption) {
        firstOption.focus()
        return
      }
      focusFirstOptionRef.current = true
      setIsSuggestionsOpen(true)
    } else if (event.key === 'Escape') {
      setIsSuggestionsOpen(false)
    }
  }

  useEffect(() => {
    if (!isSuggestionsOpen || !focusFirstOptionRef.current) return
    focusFirstOptionRef.current = false
    const firstOption = containerRef.current?.querySelector<HTMLButtonElement>(
      '[data-suggestion-option="true"]',
    )
    firstOption?.focus()
  }, [isSuggestionsOpen, suggestions, history])

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget
    const staysInside = next instanceof Node && containerRef.current?.contains(next)
    if (!staysInside) {
      setIsSuggestionsOpen(false)
    }
  }

  return (
    <header className="safe-top sticky top-0 z-40 bg-brand">
      <div className="mx-auto max-w-6xl px-3 pb-2 pt-2">
        <div className="flex items-center gap-2">
          {/*
            Marca à esquerda: pin sempre visível (mobile e desktop); o
            wordmark completo só aparece a partir de md — no mobile o espaço
            é curto demais para o nome por extenso ao lado da busca.
          */}
          <Link
            href={ROUTES.home}
            aria-label="Primeiro Aqui"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center gap-1.5"
          >
            <img
              src="/brand/pin.png"
              alt=""
              aria-hidden="true"
              width={244}
              height={321}
              className="h-8 w-auto shrink-0"
            />
            <img
              src="/brand/wordmark.png"
              alt="Primeiro Aqui"
              className="hidden h-6 w-auto shrink-0 md:block"
            />
          </Link>

          <div ref={containerRef} onBlur={handleBlur} className="relative flex-1">
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault()
                commitSearch(searchQuery)
              }}
            >
              <label htmlFor="busca-global" className="sr-only">
                Buscar produtos, lojas ou categorias
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <input
                id="busca-global"
                ref={setInputRef}
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  onSearchChange(event.target.value)
                  setIsSuggestionsOpen(true)
                }}
                onFocus={() => {
                  if (suppressFocusOpenRef.current) {
                    suppressFocusOpenRef.current = false
                    return
                  }
                  setIsSuggestionsOpen(true)
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="Buscar no Primeiro Aqui"
                enterKeyHint="search"
                autoComplete="off"
                className="h-11 w-full rounded-full border-0 bg-surface pl-9 pr-4 text-sm
                           text-ink shadow-card outline-none placeholder:text-ink-faint"
              />
              {/* Busca por foto saiu do MVP: nao ha reconhecimento de imagem no
                  backend — o botao so existia como promessa vazia. */}
            </form>

            {isSuggestionsOpen && (
              <SearchSuggestions
                query={searchQuery}
                suggestions={suggestions}
                history={history}
                onSelect={applySuggestion}
                onRemoveHistoryItem={removeTerm}
                onClearHistory={clear}
                onEscape={closeSuggestions}
                containerRef={containerRef}
              />
            )}
          </div>

          <div ref={notificationsRef} className="relative shrink-0">
            <button
              type="button"
              onClick={toggleNotifications}
              aria-haspopup="true"
              aria-expanded={isNotificationsOpen}
              aria-label={`Notificações${notificationCount ? `, ${notificationCount} não lidas` : ''}`}
              className="relative grid h-11 w-11 place-items-center rounded-full text-navy
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

            {isNotificationsOpen && (
              <NotificationsPanel notifications={notifications} onClose={() => setIsNotificationsOpen(false)} />
            )}
          </div>

          {/*
            Link real para /perfil — igual ao padrão de navegação já usado nas
            abas de categoria e no item "Mais" da barra inferior. Antes da
            migração para roteamento por URL isto era um botão com callback
            (`onOpenProfile`); o callback ficou órfão na migração e o avatar
            parou de navegar. `profileHref` permite ao pai apontar para o
            painel quando o papel for de operação, mesma regra do "Mais".
          */}
          <Link
            href={profileHref ?? ROUTES.profile}
            aria-label={isAuthenticated ? `Abrir perfil de ${userName || 'convidado'}` : 'Entrar ou criar conta'}
            className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-surface
                       text-sm font-extrabold text-ink shadow-card"
          >
            {isAuthenticated && userAvatarUrl && !avatarFailed ? (
              <img
                src={userAvatarUrl}
                alt=""
                className="h-full w-full rounded-full object-cover"
                onError={() => setAvatarFailed(true)}
              />
            ) : isAuthenticated ? (
              userInitials
            ) : (
              <LogIn className="h-5 w-5" aria-hidden="true" />
            )}
          </Link>
        </div>

        {/* Era texto fixo — "Avenida Guanabara, 148" fingia ser endereço da
            pessoa. Agora reflete o endereço padrão e leva ao cadastro. */}
        <Link
          href={ROUTES.addresses}
          className="mt-1.5 flex min-h-[44px] items-center gap-1 text-xs text-navy"
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="truncate">
            {address ? `Enviar para ${address}` : 'Escolher endereço de entrega'}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </Link>
      </div>

      <nav aria-label="Categorias" className="border-t border-navy/15">
        <ul className="rail no-scrollbar mx-auto max-w-6xl px-3">
          {categories.map((item) => {
            const active = category === item
            const href = item === 'Tudo' ? ROUTES.home : ROUTES.category(toCategorySlug(item))
            return (
              <li key={item}>
                <Link
                  href={href}
                  aria-current={active ? 'true' : undefined}
                  className={`relative flex min-h-[44px] items-center px-1 text-sm transition-colors duration-150
                              ${active ? 'font-extrabold text-navy' : 'font-semibold text-navy/70'}`}
                >
                  {item}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary"
                    />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </header>
  )
}
