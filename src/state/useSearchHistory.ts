import { useEffect, useState } from 'react'

import {
  addSearchTerm,
  clearSearchHistory,
  loadSearchHistory,
  removeSearchTerm,
  saveSearchHistory,
} from './searchHistory'

/**
 * Hook fino sobre `searchHistory.ts`: guarda o histórico em estado e
 * persiste a cada mudança. A lógica de dedup/corte mora no módulo puro —
 * aqui só entra o `useState`/`useEffect` que o teste unitário não precisa.
 */
export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>(() => loadSearchHistory())

  useEffect(() => {
    saveSearchHistory(history)
  }, [history])

  const addTerm = (term: string) => setHistory((prev) => addSearchTerm(prev, term))
  const removeTerm = (term: string) => setHistory((prev) => removeSearchTerm(prev, term))
  const clear = () => setHistory(() => clearSearchHistory())

  return { history, addTerm, removeTerm, clear }
}
