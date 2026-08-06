import { useState } from 'react'

import { readStoredJSON } from '../lib/storage'
import { STORAGE_KEYS } from './session'
import { EMPTY_BUSINESS } from './marketplaceSeed'
import type { BusinessProfile, Order } from '../types'

/**
 * Cadastro do negócio (modal de onboarding do lojista) e o pedido em rastreio.
 * Era `useOrdersAdminState`, que também carregava o painel admin mock
 * (agentes/agenda/pedidos falsos) — o painel real agora vive em
 * `useAdminDashboard` e tudo que só o mock usava foi removido. O submit real
 * do cadastro (POST /api/stores) mora em `useMarketplaceState`.
 */
export function useBusinessSetupState() {
  const [currentOrder, setCurrentOrder] = useState<Order | null>(() =>
    readStoredJSON<Order | null>(STORAGE_KEYS.currentOrder, null),
  )
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(() =>
    readStoredJSON<BusinessProfile | null>(STORAGE_KEYS.business, null),
  )
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [setupForm, setSetupForm] = useState<BusinessProfile>(() => businessProfile ?? EMPTY_BUSINESS)

  return {
    currentOrder,
    setCurrentOrder,
    businessProfile,
    setBusinessProfile,
    isSetupOpen,
    setIsSetupOpen,
    setupForm,
    setSetupForm,
    onSetupFormChange: (patch: Partial<BusinessProfile>) => setSetupForm((prev) => ({ ...prev, ...patch })),
    onSetupClose: () => setIsSetupOpen(false),
  }
}
