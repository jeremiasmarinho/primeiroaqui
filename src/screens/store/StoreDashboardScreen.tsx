import { Gift, MapPin, Store as StoreIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'wouter'

import EmptyState from '../../components/EmptyState'
import { ApiError } from '../../lib/api'
import { formatCents } from '../../lib/money'
import { ROUTES } from '../../router/routes'
import { useStoreDashboard } from '../../state/useStoreDashboard'
import type { Role } from '../../types'
import OrdersPanel from './OrdersPanel'
import ProductsPanel from './ProductsPanel'
import StoreCustomersPanel from './StoreCustomersPanel'

type DashboardTab = 'orders' | 'products' | 'customers'

/** Iniciais (até 2 letras) a partir do nome, mesmo padrão de ProfileScreen. */
const initialsFromName = (name: string): string =>
  name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()

interface StoreDashboardScreenProps {
  userRole: Role
}

/**
 * Painel do lojista (/minha-loja): visão geral dos pedidos recebidos e gestão
 * dos produtos. É ferramenta de trabalho, não vitrine — hierarquia direta,
 * sem hero. A rota já é protegida por sessão; o guard de papel fica aqui.
 */
export default function StoreDashboardScreen({ userRole }: StoreDashboardScreenProps) {
  const canOperate = userRole === 'STORE_OWNER' || userRole === 'ADMIN'
  const dashboard = useStoreDashboard(canOperate)
  const [tab, setTab] = useState<DashboardTab>('orders')
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [logoPending, setLogoPending] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [giftWrapPending, setGiftWrapPending] = useState(false)
  const [pickupAddressDraft, setPickupAddressDraft] = useState('')
  const [pickupPending, setPickupPending] = useState(false)

  const handleLogoPick = () => logoInputRef.current?.click()

  const handleToggleGiftWrap = async () => {
    if (!dashboard.store) return
    setGiftWrapPending(true)
    await dashboard.updateGiftWrapAvailable(!dashboard.store.giftWrapAvailable)
    setGiftWrapPending(false)
  }

  const handleEnablePickup = async () => {
    if (!dashboard.store || !pickupAddressDraft.trim()) return
    setPickupPending(true)
    const ok = await dashboard.updatePickupAvailable(true, pickupAddressDraft.trim())
    if (ok) setPickupAddressDraft('')
    setPickupPending(false)
  }

  const handleDisablePickup = async () => {
    if (!dashboard.store) return
    setPickupPending(true)
    await dashboard.updatePickupAvailable(false)
    setPickupPending(false)
  }

  const handleLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setLogoError('')
    setLogoPending(true)
    try {
      await dashboard.uploadLogo(file)
    } catch (error) {
      setLogoError(error instanceof ApiError ? error.message : 'Não foi possível enviar o logo. Tente novamente.')
    } finally {
      setLogoPending(false)
    }
  }

  const handleRemoveLogo = async () => {
    setLogoError('')
    setLogoPending(true)
    try {
      await dashboard.removeLogo()
    } catch (error) {
      setLogoError(error instanceof ApiError ? error.message : 'Não foi possível remover o logo. Tente novamente.')
    } finally {
      setLogoPending(false)
    }
  }

  if (!canOperate) {
    return (
      <EmptyState
        Icon={StoreIcon}
        title="Área do lojista"
        message="Esta área é para quem vende no Primeiro Aqui. Cadastre seu negócio no seu perfil."
        actionLabel="Ir para o perfil"
        actionHref={ROUTES.profile}
      />
    )
  }

  if (dashboard.isLoading) {
    return (
      <div role="status" className="grid min-h-dvh place-items-center bg-surface-page p-6">
        <p className="text-sm font-semibold text-ink-muted">Carregando sua loja…</p>
      </div>
    )
  }

  if (dashboard.loadError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface-page p-6">
        <div className="rounded-card bg-surface p-6 text-center shadow-card">
          <p className="font-semibold text-ink">{dashboard.loadError}</p>
          <button onClick={dashboard.retry} className="btn-primary mt-4 min-h-[44px] rounded-[16px] px-4 py-2 text-sm font-semibold">
            Tentar de novo
          </button>
        </div>
      </div>
    )
  }

  if (!dashboard.store) {
    return (
      <EmptyState
        Icon={StoreIcon}
        title="Você ainda não tem loja"
        message="Complete o cadastro do seu negócio no perfil para começar a vender."
        actionLabel="Ir para o perfil"
        actionHref={ROUTES.profile}
      />
    )
  }

  const { metrics } = dashboard

  return (
    <div className="min-h-screen bg-surface-page p-4 md:p-8">
      <div className="mx-auto max-w-4xl rounded-card bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/brand/pin.png" alt="" aria-hidden="true" className="h-6 w-6 shrink-0" />
            <div className="relative">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-page text-sm font-extrabold text-ink">
                {dashboard.store.logoUrl ? (
                  <img src={dashboard.store.logoUrl} alt="Logo da loja" className="h-full w-full rounded-full object-cover" />
                ) : (
                  initialsFromName(dashboard.store.name)
                )}
              </div>
              {logoPending && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-xs font-semibold text-white"
                >
                  ...
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Minha loja</p>
              <h1 className="font-display text-2xl font-black text-ink">{dashboard.store.name}</h1>
              <div className="mt-1 flex items-center gap-3 text-xs font-semibold">
                <button type="button" onClick={handleLogoPick} disabled={logoPending} className="motion-safe:active:scale-95 text-primary transition-transform disabled:opacity-50">
                  {logoPending ? 'Enviando…' : 'Trocar logo'}
                </button>
                {dashboard.store.logoUrl && (
                  <button type="button" onClick={() => void handleRemoveLogo()} disabled={logoPending} className="motion-safe:active:scale-95 text-error transition-transform disabled:opacity-50">
                    Remover logo
                  </button>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Selecionar logo da loja"
                onChange={(event) => void handleLogoFileChange(event)}
              />
              {logoError && <p className="mt-1 text-xs font-semibold text-error">{logoError}</p>}
            </div>
          </div>
          <Link href={ROUTES.profile} className="min-h-[44px] rounded-[16px] border border-line px-4 py-2 text-sm font-semibold text-ink-muted">
            Voltar ao perfil
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-card bg-surface-page p-4">
            <p className="text-sm text-ink-muted">Pedidos hoje</p>
            <p className="tabular text-2xl font-black text-ink">{metrics.ordersToday}</p>
          </div>
          <div className="rounded-card bg-surface-page p-4">
            <p className="text-sm text-ink-muted">Aguardando confirmação</p>
            <p className="tabular text-2xl font-black text-ink">{metrics.pending}</p>
          </div>
          <div className="rounded-card bg-surface-page p-4">
            <p className="text-sm text-ink-muted">Faturamento</p>
            <p className="tabular text-2xl font-black text-ink">{formatCents(metrics.revenueCents)}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-card border border-line p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Gift className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
            Embalo para presente
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={dashboard.store.giftWrapAvailable}
            aria-label="Embalo para presente"
            onClick={() => void handleToggleGiftWrap()}
            disabled={giftWrapPending}
            className={`min-h-[32px] w-14 shrink-0 rounded-full p-1 transition-colors duration-150 disabled:opacity-60 ${
              dashboard.store.giftWrapAvailable ? 'bg-primary' : 'bg-surface-sunken'
            }`}
          >
            <span
              className={`block h-6 w-6 rounded-full bg-white shadow transition-transform duration-150 ${
                dashboard.store.giftWrapAvailable ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="mt-4 rounded-card border border-line p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <MapPin className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
            Retirada na loja
          </p>
          {dashboard.store.pickupAvailable ? (
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-sm text-ink-muted">Retire em: {dashboard.store.address}</p>
              <button
                type="button"
                onClick={() => void handleDisablePickup()}
                disabled={pickupPending}
                className="min-h-[36px] shrink-0 rounded-[14px] border border-line px-3 text-xs font-semibold text-ink-muted disabled:opacity-60"
              >
                Desativar retirada
              </button>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <label htmlFor="pickup-address" className="sr-only">
                Endereço para retirada
              </label>
              <input
                id="pickup-address"
                value={pickupAddressDraft}
                onChange={(event) => setPickupAddressDraft(event.target.value)}
                placeholder="Endereço da loja"
                className="field-input"
              />
              <button
                type="button"
                onClick={() => void handleEnablePickup()}
                disabled={pickupPending || !pickupAddressDraft.trim()}
                className="min-h-[36px] w-full rounded-[14px] bg-primary px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Habilitar retirada
              </button>
            </div>
          )}
        </div>

        {dashboard.actionError ? (
          <p role="alert" className="mt-4 rounded-[16px] bg-error/10 px-4 py-3 text-sm font-semibold text-error">
            {dashboard.actionError}
          </p>
        ) : null}

        <div role="tablist" aria-label="Seções do painel" className="mt-6 flex gap-2 border-b border-line pb-2">
          <button
            role="tab"
            aria-selected={tab === 'orders'}
            onClick={() => setTab('orders')}
            className={`min-h-[44px] rounded-[16px] px-4 py-2 text-sm font-semibold ${tab === 'orders' ? 'btn-primary' : 'text-ink-muted'}`}
          >
            Pedidos
          </button>
          <button
            role="tab"
            aria-selected={tab === 'products'}
            onClick={() => setTab('products')}
            className={`min-h-[44px] rounded-[16px] px-4 py-2 text-sm font-semibold ${tab === 'products' ? 'btn-primary' : 'text-ink-muted'}`}
          >
            Meus produtos
          </button>
          <button
            role="tab"
            aria-selected={tab === 'customers'}
            onClick={() => setTab('customers')}
            className={`min-h-[44px] rounded-[16px] px-4 py-2 text-sm font-semibold ${tab === 'customers' ? 'btn-primary' : 'text-ink-muted'}`}
          >
            Clientes
          </button>
        </div>

        <div className="mt-4">
          {tab === 'orders' ? (
            <OrdersPanel
              orders={dashboard.orders}
              pendingOrderIds={dashboard.pendingOrderIds}
              onChangeStatus={(id, status) => void dashboard.changeOrderStatus(id, status)}
            />
          ) : tab === 'products' ? (
            <ProductsPanel
              products={dashboard.products}
              pendingProductIds={dashboard.pendingProductIds}
              onCreate={dashboard.createProduct}
              onUpdate={dashboard.updateProduct}
              onUploadPhoto={dashboard.uploadPhoto}
            />
          ) : (
            <StoreCustomersPanel customers={dashboard.customers} />
          )}
        </div>
      </div>
    </div>
  )
}
