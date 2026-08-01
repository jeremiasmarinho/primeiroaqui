import { History, Search, X } from 'lucide-react'
import type { KeyboardEvent } from 'react'

import type { SearchSuggestion } from '../state/searchSuggestions'

/**
 * Dropdown de busca: histórico (campo vazio) ou sugestões (campo com termo).
 *
 * Cada opção é um `<button>` de verdade — foco real do navegador em vez de
 * `aria-activedescendant` virtual, então setas/Tab funcionam com o teclado
 * sem exigir o padrão ARIA combobox inteiro.
 */
interface SearchSuggestionsProps {
  query: string
  suggestions: SearchSuggestion[]
  history: string[]
  onSelect: (term: string) => void
  onRemoveHistoryItem: (term: string) => void
  onClearHistory: () => void
  onEscape: () => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

const preventBlur = (event: React.MouseEvent) => event.preventDefault()

export default function SearchSuggestions({
  query,
  suggestions,
  history,
  onSelect,
  onRemoveHistoryItem,
  onClearHistory,
  onEscape,
  containerRef,
}: SearchSuggestionsProps) {
  const isHistoryMode = query.trim() === ''
  const options = isHistoryMode ? history : suggestions.map((item) => item.label)

  if (options.length === 0) return null

  const focusOptionAt = (index: number) => {
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('[data-suggestion-option="true"]')
    if (!buttons || buttons.length === 0) return
    const bounded = (index + buttons.length) % buttons.length
    buttons[bounded]?.focus()
  }

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusOptionAt(index + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusOptionAt(index - 1)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onEscape()
    }
  }

  return (
    <div className="absolute inset-x-0 top-[calc(100%+0.375rem)] z-50 overflow-hidden rounded-card bg-surface shadow-card">
      {isHistoryMode && (
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-micro font-bold uppercase tracking-wide text-ink-faint">
            Buscas recentes
          </span>
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={onClearHistory}
            className="flex min-h-[44px] items-center px-2 text-sm font-bold text-ink-muted transition-colors duration-150 hover:text-ink"
          >
            Limpar
          </button>
        </div>
      )}

      <ul
        aria-label={isHistoryMode ? 'Buscas recentes' : 'Sugestões de busca'}
        className="max-h-72 overflow-y-auto py-1"
      >
        {options.map((label, index) => (
          <li key={`${isHistoryMode ? 'historico' : 'sugestao'}-${label}-${index}`} className="px-1">
            <div className="flex items-center">
              <button
                type="button"
                data-suggestion-option="true"
                onMouseDown={preventBlur}
                onClick={() => onSelect(label)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                aria-label={isHistoryMode ? `Buscar novamente por ${label}` : `Buscar por ${label}`}
                className="flex min-h-[44px] flex-1 items-center gap-2 rounded-lg px-3 text-left text-sm text-ink transition-colors duration-150 hover:bg-surface-sunken focus-visible:bg-surface-sunken"
              >
                {isHistoryMode ? (
                  <History className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
                ) : (
                  <Search className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
                )}
                <span className="truncate">{label}</span>
              </button>

              {isHistoryMode && (
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={() => onRemoveHistoryItem(label)}
                  onKeyDown={(event) => handleOptionKeyDown(event, index)}
                  aria-label={`Remover ${label} do histórico de busca`}
                  className="grid h-11 w-11 shrink-0 place-items-center text-ink-faint transition-colors duration-150 hover:text-ink"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
