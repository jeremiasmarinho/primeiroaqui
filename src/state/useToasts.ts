import { useEffect, useState } from 'react'

/**
 * Toasts transitórios (feedback imediato de ações do comprador). Estado vive
 * fora do React (módulo) porque a fonte das ações — `useCatalogState`,
 * `toggleFavoriteWithApi`, submits de formulário — está espalhada por vários
 * hooks que não compartilham uma árvore de componentes comum acima de
 * `MarketplaceApp`. Um `Provider`/`Context` exigiria içar esse estado acima
 * de `useMarketplaceState`, o que reescreveria a composição do app inteiro
 * só para isso. O padrão segue o mesmo espírito de `session.ts`
 * (módulo com estado compartilhado + `STORAGE_KEYS`).
 *
 * O sino (`NotificationsPanel`) continua a fonte de verdade persistente;
 * toast é só o "flash" imediato — some sozinho, não precisa ser lido depois.
 */
export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
}

/** Só os 3 mais recentes ficam visíveis; os demais entram na fila. */
const MAX_VISIBLE = 3
const AUTO_DISMISS_MS = 3500

let toasts: ToastItem[] = []
let idSeq = 1
const listeners = new Set<(items: ToastItem[]) => void>()
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function emit() {
  listeners.forEach((listener) => listener(toasts))
}

export function pushToast(message: string, type: ToastType = 'info') {
  const id = idSeq++
  toasts = [...toasts, { id, message, type }]
  emit()
  const timer = setTimeout(() => dismissToast(id), AUTO_DISMISS_MS)
  timers.set(id, timer)
  return id
}

export function dismissToast(id: number) {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
  toasts = toasts.filter((item) => item.id !== id)
  emit()
}

/** Só para testes: zera o módulo entre casos para não vazar estado. */
export function resetToasts() {
  timers.forEach((timer) => clearTimeout(timer))
  timers.clear()
  toasts = []
  idSeq = 1
  emit()
}

export function useToasts() {
  const [items, setItems] = useState<ToastItem[]>(toasts)

  useEffect(() => {
    listeners.add(setItems)
    setItems(toasts)
    return () => {
      listeners.delete(setItems)
    }
  }, [])

  return {
    // Mais recentes por último, mas só os últimos MAX_VISIBLE aparecem.
    visibleToasts: items.slice(-MAX_VISIBLE),
    dismissToast,
  }
}
