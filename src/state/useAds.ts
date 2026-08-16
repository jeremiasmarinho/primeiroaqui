import { useEffect, useState } from 'react'
import { api, type ApiAdsResponse } from '../lib/api'

/** Estado inicial vazio — mesmo shape que a home usa como fallback. */
const EMPTY_ADS: ApiAdsResponse = { heroCarousel: [], highlightStrip: null, sponsoredFeed: [] }

/**
 * Anúncios reais: GET /ads ao montar. Falha silenciosa — a home nunca quebra
 * por causa de anúncio, então qualquer erro (rede, 5xx) simplesmente mantém
 * o estado vazio e a UI cai no fallback (mesmo padrão de
 * `useRemoteNotifications`).
 */
export function useAds(): { ads: ApiAdsResponse; isLoading: boolean } {
  const [ads, setAds] = useState<ApiAdsResponse>(EMPTY_ADS)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    api
      .fetchAds()
      .then((response) => {
        if (cancelled) return
        setAds(response)
      })
      .catch(() => {
        // Silencioso: anúncio é conveniência, não pode derrubar a home.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { ads, isLoading }
}
