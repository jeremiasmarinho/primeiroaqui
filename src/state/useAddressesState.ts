import { useCallback, useEffect, useState } from 'react'

import { api, ApiError, loadStoredSession } from '../lib/api'
import { toViewAddress } from '../lib/adapters'
import {
  EMPTY_ADDRESS,
  formatCep,
  getDefaultAddress,
  validateAddressDraft,
  type AddressDraft,
} from './addresses'
import { pushToast } from './useToasts'
import type { Address } from '../types'

/**
 * Endereços reais: GET /api/me/addresses quando há sessão, POST /api/addresses
 * no cadastro.
 *
 * O backend ainda não expõe remover nem trocar o padrão (só POST e GET) —
 * essas ações saíram da tela nesta fase em vez de fingir que funcionam
 * (pendência registrada para a fase de conta).
 *
 * `hasSession` entra por parâmetro (derivado do usuário logado) para o efeito
 * recarregar quando a pessoa entra/sai.
 */
export function useAddressesState(hasSession: boolean) {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [addressForm, setAddressForm] = useState<AddressDraft>(EMPTY_ADDRESS)
  const [addressError, setAddressError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!hasSession || !loadStoredSession()) {
      setAddresses([])
      return
    }
    let cancelled = false
    setIsLoading(true)
    setLoadError('')
    api
      .listAddresses()
      .then(({ addresses: dtos }) => {
        if (!cancelled) setAddresses(dtos.map(toViewAddress))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(
          err instanceof ApiError && err.status > 0
            ? err.message
            : 'Não foi possível carregar seus endereços.',
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [hasSession, reloadKey])

  const retry = useCallback(() => setReloadKey((key) => key + 1), [])

  const onAddressFormChange = (patch: Partial<AddressDraft>) => {
    setAddressForm((prev) => ({
      ...prev,
      ...patch,
      // A máscara mora no estado, não no input: assim o valor validado e o
      // valor exibido são o mesmo.
      ...(patch.cep === undefined ? {} : { cep: formatCep(patch.cep) }),
    }))
  }

  const onAddressSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return // trava duplo clique/duplo submit

    const validated = validateAddressDraft(addressForm)
    if (!validated.ok) {
      setAddressError(validated.message)
      return
    }

    setIsSubmitting(true)
    try {
      const { address } = await api.createAddress({
        label: validated.label,
        street: validated.street,
        city: validated.city,
        state: validated.state,
        zipCode: validated.cep,
        // Sem geocoding no front nesta fase: coordenadas neutras. A busca por
        // raio ignora endereços em (0,0) — pendência da fase de descoberta.
        latitude: 0,
        longitude: 0,
        // Primeiro endereço já entra como padrão para o checkout ter sugestão.
        isDefault: addresses.length === 0,
      })
      setAddressError('')
      setAddresses((prev) => [toViewAddress(address), ...prev])
      setAddressForm(EMPTY_ADDRESS)
      pushToast('Endereço salvo', 'success')
    } catch (err) {
      setAddressError(
        err instanceof ApiError && err.status > 0
          ? err.message
          : 'Não foi possível salvar o endereço. Tente novamente.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    addresses,
    setAddresses,
    addressForm,
    setAddressForm,
    addressError,
    setAddressError,
    isLoading,
    loadError,
    retry,
    selectedAddressId,
    setSelectedAddressId,
    defaultAddress: getDefaultAddress(addresses),
    onAddressFormChange,
    onAddressSubmit,
    isSubmitting,
  }
}
