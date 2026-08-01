import { readStoredJSON, writeStoredJSON } from '../lib/storage'
import { STORAGE_KEYS } from './session'

/**
 * Histórico de busca — lógica pura.
 *
 * Sem `Date.now()`: a ordem "mais recente primeiro" vem da posição no array,
 * não de timestamp, então não há nada para injetar aqui.
 */

/** Acima disso o histórico vira ruído, não atalho. */
export const MAX_SEARCH_HISTORY = 8

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

/**
 * Adiciona um termo ao histórico: sem duplicata (comparação sem caixa), mais
 * recente primeiro, cortado em `MAX_SEARCH_HISTORY`. Termo vazio ou só
 * espaço não entra — não há o que lembrar de uma busca em branco.
 */
export const addSearchTerm = (history: string[], term: string): string[] => {
  const trimmed = term.trim()
  if (!trimmed) return history

  const withoutDuplicate = history.filter(
    (item) => item.toLowerCase() !== trimmed.toLowerCase(),
  )
  return [trimmed, ...withoutDuplicate].slice(0, MAX_SEARCH_HISTORY)
}

/** Remove um termo específico, comparação sem caixa. */
export const removeSearchTerm = (history: string[], term: string): string[] =>
  history.filter((item) => item.toLowerCase() !== term.trim().toLowerCase())

/** Esvazia o histórico. Função só para deixar a intenção explícita nas telas. */
export const clearSearchHistory = (): string[] => []

export const loadSearchHistory = (): string[] =>
  readStoredJSON<string[]>(STORAGE_KEYS.searchHistory, [], isStringArray)

export const saveSearchHistory = (history: string[]): void => {
  writeStoredJSON(STORAGE_KEYS.searchHistory, history)
}
