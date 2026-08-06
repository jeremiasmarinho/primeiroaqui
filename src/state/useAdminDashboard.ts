import { useCallback, useEffect, useState } from 'react'

import {
  api,
  ApiError,
  type ApiAdminMetrics,
  type ApiAdminOrder,
  type ApiAdminStore,
} from '../lib/api'
import type { ApiOrderStatus } from '../lib/orderStatus'

const ORDERS_PAGE_SIZE = 20

/**
 * Estado do painel admin da plataforma (/admin): métricas agregadas, pedidos
 * de todas as lojas (paginados) e lojas para moderação — tudo da API real.
 * Fatia própria, como `useStoreDashboard`: ferramenta de operação não divide
 * estado com a vitrine.
 */
export function useAdminDashboard(enabled: boolean) {
  const [metrics, setMetrics] = useState<ApiAdminMetrics | null>(null)
  const [orders, setOrders] = useState<ApiAdminOrder[]>([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [stores, setStores] = useState<ApiAdminStore[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setIsLoading(true)
    setLoadError('')
    ;(async () => {
      try {
        const [metricsRes, ordersRes, storesRes] = await Promise.all([
          api.adminMetrics(),
          api.adminOrders({ limit: ORDERS_PAGE_SIZE, offset: 0 }),
          api.adminStores(),
        ])
        if (cancelled) return
        setMetrics(metricsRes)
        setOrders(ordersRes.orders)
        setOrdersTotal(ordersRes.total)
        setStores(storesRes.stores)
      } catch (err) {
        if (cancelled) return
        setLoadError(
          err instanceof ApiError && err.status > 0
            ? err.message
            : 'Não foi possível carregar o painel. Verifique a conexão e tente novamente.',
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

  /** "Carregar mais" da tabela de pedidos: anexa a próxima página. */
  const loadMoreOrders = useCallback(async () => {
    setActionError('')
    setIsLoadingMore(true)
    try {
      const { orders: page, total } = await api.adminOrders({
        limit: ORDERS_PAGE_SIZE,
        offset: orders.length,
      })
      setOrders((prev) => {
        const known = new Set(prev.map((order) => order.id))
        return [...prev, ...page.filter((order) => !known.has(order.id))]
      })
      setOrdersTotal(total)
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.status > 0
          ? err.message
          : 'Não foi possível carregar mais pedidos. Tente novamente.',
      )
    } finally {
      setIsLoadingMore(false)
    }
  }, [orders.length])

  /** Avança/cancela qualquer pedido da plataforma (admin pode tudo que a máquina permite). */
  const changeOrderStatus = useCallback(async (orderId: string, status: ApiOrderStatus) => {
    setActionError('')
    try {
      const { order } = await api.updateOrderStatus(orderId, status)
      setOrders((prev) =>
        prev.map((item) =>
          item.id === orderId ? { ...item, status: order.status, updatedAt: order.updatedAt } : item,
        ),
      )
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.status > 0
          ? err.message
          : 'Não foi possível atualizar o pedido. Tente novamente.',
      )
    }
  }, [])

  /** Moderação: ativa/desativa a loja e reflete a resposta na tabela. */
  const setStoreActive = useCallback(async (storeId: string, isActive: boolean) => {
    setActionError('')
    try {
      const { store } = await api.adminSetStoreActive(storeId, isActive)
      setStores((prev) =>
        prev.map((item) => (item.id === storeId ? { ...item, isActive: store.isActive } : item)),
      )
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.status > 0
          ? err.message
          : 'Não foi possível atualizar a loja. Tente novamente.',
      )
    }
  }, [])

  return {
    metrics,
    orders,
    ordersTotal,
    hasMoreOrders: orders.length < ordersTotal,
    stores,
    isLoading,
    isLoadingMore,
    loadError,
    actionError,
    retry,
    loadMoreOrders,
    changeOrderStatus,
    setStoreActive,
  }
}
