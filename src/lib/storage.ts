const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    // Aba privada ou storage bloqueado por politica: o app segue sem persistir.
    return null
  }
}

/**
 * Le JSON do storage. `validator` e um type guard opcional: sem ele o dado
 * volta como `T` sob responsabilidade de quem chama; com ele, dado com formato
 * errado cai no fallback em vez de vazar para a UI.
 */
export const readStoredJSON = <T,>(
  key: string,
  fallback: T,
  validator?: (value: unknown) => value is T,
): T => {
  const storage = getStorage()
  if (!storage) return fallback

  const raw = storage.getItem(key)
  if (!raw) return fallback

  try {
    const parsed: unknown = JSON.parse(raw)
    if (validator) {
      return validator(parsed) ? parsed : fallback
    }
    return parsed as T
  } catch {
    return fallback
  }
}

/**
 * Grava JSON. `null`/`undefined` removem a chave em vez de gravar "null".
 *
 * A escrita pode falhar mesmo com storage disponivel: cota estourada, Safari
 * em navegacao privada, politica corporativa. Persistencia e um bonus — falhar
 * ao gravar nunca pode derrubar a interface.
 */
export const writeStoredJSON = (key: string, value: unknown): void => {
  const storage = getStorage()
  if (!storage) return

  try {
    if (value === null || value === undefined) {
      storage.removeItem(key)
      return
    }

    storage.setItem(key, JSON.stringify(value))
  } catch {
    // Silencioso de proposito: o app segue funcionando sem persistir.
  }
}
