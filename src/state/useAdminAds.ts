import { useCallback, useEffect, useState } from 'react'

import { api, ApiError, type ApiAdInput, type ApiAdminAd } from '../lib/api'
import { pushToast } from './useToasts'

/**
 * Estado da aba Anúncios do painel admin: lista de anúncios (todos os slots,
 * todos os status) e as ações de criar/editar/ativar-desativar. Fatia
 * própria, no molde de `useAdminDashboard` — não empilha em cima dele porque
 * anúncios não fazem parte das métricas/pedidos/lojas que ele já carrega.
 *
 * Nota sobre `token`: `adminListAds`/`adminCreateAd`/`adminUpdateAd` aceitam
 * um token de fallback, mas a sessão salva no storage sempre tem prioridade
 * dentro de `request()` (ver comentário em src/lib/api.ts) — como o admin já
 * está autenticado quando chega nesta tela, passamos string vazia.
 */
export function useAdminAds(enabled: boolean) {
  const [ads, setAds] = useState<ApiAdminAd[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [pendingAdIds, setPendingAdIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setIsLoading(true)
    setLoadError('')
    ;(async () => {
      try {
        const { ads: list } = await api.adminListAds('')
        if (cancelled) return
        setAds(list)
      } catch (err) {
        if (cancelled) return
        setLoadError(
          err instanceof ApiError && err.status > 0
            ? err.message
            : 'Não foi possível carregar os anúncios. Verifique a conexão e tente novamente.',
        )
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, reloadKey])

  const retry = useCallback(() => setReloadKey((key) => key + 1), [])

  /** Cria um anúncio novo e insere na lista local sem esperar reload. */
  const createAd = useCallback(async (input: ApiAdInput) => {
    setActionError('')
    try {
      const { ad } = await api.adminCreateAd('', input)
      setAds((prev) => [ad, ...prev])
      pushToast('Anúncio criado', 'success')
      return true
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.status > 0
          ? err.message
          : 'Não foi possível criar o anúncio. Tente novamente.',
      )
      return false
    }
  }, [])

  /** Edita um anúncio existente (formulário reaproveitado para criar e editar). */
  const updateAd = useCallback(async (id: string, input: Partial<ApiAdInput>) => {
    if (pendingAdIds.has(id)) return false
    setActionError('')
    setPendingAdIds((prev) => new Set(prev).add(id))
    try {
      const { ad } = await api.adminUpdateAd('', id, input)
      setAds((prev) => prev.map((item) => (item.id === id ? ad : item)))
      return true
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.status > 0
          ? err.message
          : 'Não foi possível atualizar o anúncio. Tente novamente.',
      )
      return false
    } finally {
      setPendingAdIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [pendingAdIds])

  /** Atalho de moderação: ativa/desativa sem passar pelo formulário. */
  const setAdActive = useCallback(
    async (id: string, active: boolean) => {
      const ok = await updateAd(id, { active })
      if (ok) pushToast(active ? 'Anúncio reativado' : 'Anúncio desativado', active ? 'success' : 'info')
      return ok
    },
    [updateAd],
  )

  /** Salva edição via formulário — feedback distinto do toggle de ativo. */
  const editAd = useCallback(
    async (id: string, input: Partial<ApiAdInput>) => {
      const ok = await updateAd(id, input)
      if (ok) pushToast('Anúncio atualizado', 'success')
      return ok
    },
    [updateAd],
  )

  return {
    ads,
    isLoading,
    loadError,
    actionError,
    pendingAdIds,
    retry,
    createAd,
    editAd,
    setAdActive,
  }
}
