const getStorage = () => {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const readStoredJSON = (key, fallback, validator) => {
  const storage = getStorage()
  if (!storage) return fallback

  const raw = storage.getItem(key)
  if (!raw) return fallback

  try {
    const parsed = JSON.parse(raw)
    if (typeof validator === 'function') {
      return validator(parsed) ? parsed : fallback
    }
    return parsed
  } catch {
    return fallback
  }
}

export const writeStoredJSON = (key, value) => {
  const storage = getStorage()
  if (!storage) return

  if (value === null || value === undefined) {
    storage.removeItem(key)
    return
  }

  storage.setItem(key, JSON.stringify(value))
}
