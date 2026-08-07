import { useCallback, useEffect, useMemo, useState } from 'react'

import { api, ApiError, type ApiProduct, type ApiStore, type ApiStoreCustomer, type ApiStoreOrder } from '../lib/api'
import type { ApiOrderStatus } from '../lib/orderStatus'
import { pushToast } from './useToasts'

/**
 * Estado do painel do lojista (/minha-loja): loja, pedidos recebidos e
 * produtos, direto da API real. Fatia separada de `useMarketplaceState` de
 * propósito — o painel é ferramenta do lojista e não compartilha nada com a
 * vitrine do comprador além do cliente HTTP.
 *
 * MVP: um lojista opera UMA loja (a primeira de GET /me/stores). Multi-loja
 * fica para quando o negócio pedir.
 */
export function useStoreDashboard(enabled: boolean) {
  const [store, setStore] = useState<ApiStore | null>(null)
  const [orders, setOrders] = useState<ApiStoreOrder[]>([])
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [customers, setCustomers] = useState<ApiStoreCustomer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [pendingOrderIds, setPendingOrderIds] = useState<Set<string>>(new Set())
  const [pendingProductIds, setPendingProductIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setIsLoading(true)
    setLoadError('')
    ;(async () => {
      try {
        const { stores } = await api.listMyStores()
        const first = stores[0] ?? null
        if (cancelled) return
        setStore(first)
        if (!first) {
          setOrders([])
          setProducts([])
          setCustomers([])
          return
        }
        const [{ orders: storeOrders }, { products: storeProducts }, { customers: storeCustomers }] = await Promise.all([
          api.listStoreOrders(),
          api.listProducts({ storeId: first.id, limit: 50 }),
          api.listStoreCustomers(),
        ])
        if (cancelled) return
        setOrders(storeOrders)
        setProducts(storeProducts)
        setCustomers(storeCustomers)
      } catch (err) {
        if (cancelled) return
        setLoadError(
          err instanceof ApiError && err.status > 0
            ? err.message
            : 'Não foi possível carregar sua loja. Verifique a conexão e tente novamente.',
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

  /** Avança/cancela um pedido; a lista reflete a resposta do servidor. */
  const changeOrderStatus = useCallback(async (orderId: string, status: ApiOrderStatus) => {
    if (pendingOrderIds.has(orderId)) return
    setActionError('')
    setPendingOrderIds((prev) => new Set(prev).add(orderId))
    try {
      const { order } = await api.updateOrderStatus(orderId, status)
      setOrders((prev) =>
        prev.map((item) => (item.id === orderId ? { ...item, status: order.status, updatedAt: order.updatedAt } : item)),
      )
      pushToast(
        status === 'CANCELED' ? 'Pedido cancelado' : 'Status do pedido atualizado',
        status === 'CANCELED' ? 'info' : 'success',
      )
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.status > 0
          ? err.message
          : 'Não foi possível atualizar o pedido. Tente novamente.',
      )
    } finally {
      setPendingOrderIds((prev) => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
    }
  }, [pendingOrderIds])

  const createProduct = useCallback(
    async (input: { title: string; category: string; priceCents: number; stock: number; description?: string }) => {
      if (!store) return false
      setActionError('')
      try {
        const { product } = await api.createProduct(store.id, input)
        setProducts((prev) => [product, ...prev])
        pushToast('Produto publicado', 'success')
        return true
      } catch (err) {
        setActionError(
          err instanceof ApiError && err.status > 0
            ? err.message
            : 'Não foi possível publicar o produto. Tente novamente.',
        )
        return false
      }
    },
    [store],
  )

  const updateProduct = useCallback(
    async (
      productId: string,
      patch: Partial<{ title: string; category: string; priceCents: number; stock: number; isActive: boolean }>,
    ) => {
      if (pendingProductIds.has(productId)) return false
      setActionError('')
      setPendingProductIds((prev) => new Set(prev).add(productId))
      try {
        const { product } = await api.updateProduct(productId, patch)
        setProducts((prev) => prev.map((item) => (item.id === productId ? product : item)))
        pushToast(
          typeof patch.isActive === 'boolean'
            ? product.isActive
              ? 'Produto ativado'
              : 'Produto desativado'
            : 'Produto atualizado',
          'success',
        )
        return true
      } catch (err) {
        setActionError(
          err instanceof ApiError && err.status > 0
            ? err.message
            : 'Não foi possível salvar o produto. Tente novamente.',
        )
        return false
      } finally {
        setPendingProductIds((prev) => {
          const next = new Set(prev)
          next.delete(productId)
          return next
        })
      }
    },
    [pendingProductIds],
  )

  const uploadPhoto = useCallback(async (productId: string, file: File) => {
    setActionError('')
    try {
      await api.uploadProductPhoto(productId, file)
      pushToast('Foto enviada', 'success')
      return true
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.status > 0
          ? err.message
          : 'Não foi possível enviar a foto. Tente novamente.',
      )
      return false
    }
  }, [])

  const uploadLogo = useCallback(async (file: File) => {
    if (!store) return false
    setActionError('')
    try {
      const { store: updated } = await api.uploadStoreLogo(store.id, file)
      setStore(updated)
      pushToast('Logo atualizada', 'success')
      return true
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.status > 0
          ? err.message
          : 'Não foi possível enviar o logo. Tente novamente.',
      )
      return false
    }
  }, [store])

  const removeLogo = useCallback(async () => {
    if (!store) return false
    setActionError('')
    try {
      const { store: updated } = await api.removeStoreLogo(store.id)
      setStore(updated)
      pushToast('Logo removida', 'success')
      return true
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.status > 0
          ? err.message
          : 'Não foi possível remover o logo. Tente novamente.',
      )
      return false
    }
  }, [store])

  /** Cards da visão geral: pedidos de hoje, pendentes e faturamento (pedidos não cancelados). */
  const metrics = useMemo(() => {
    const today = new Date()
    const isToday = (iso: string) => {
      const date = new Date(iso)
      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      )
    }
    return {
      ordersToday: orders.filter((order) => isToday(order.createdAt)).length,
      pending: orders.filter((order) => order.status === 'PENDING').length,
      revenueCents: orders
        .filter((order) => order.status !== 'CANCELED')
        .reduce((sum, order) => sum + order.totalCents, 0),
    }
  }, [orders])

  return {
    store,
    orders,
    products,
    customers,
    metrics,
    isLoading,
    loadError,
    actionError,
    pendingOrderIds,
    pendingProductIds,
    retry,
    changeOrderStatus,
    createProduct,
    updateProduct,
    uploadPhoto,
    uploadLogo,
    removeLogo,
  }
}
