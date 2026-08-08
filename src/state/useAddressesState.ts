import { useCallback, useEffect, useState } from 'react'

import { api, ApiError, loadStoredSession } from '../lib/api'
import { toViewAddress } from '../lib/adapters'
import { isCompleteCep, lookupCep } from '../lib/cep'
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
 * no cadastro, PATCH /api/addresses/:id para editar, PATCH
 * /api/addresses/:id/default para trocar o padrão, DELETE /api/addresses/:id
 * para excluir.
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
  /** Endereço em edição (form CEP-first reaproveitado) — vazio = modo cadastro. */
  const [editingAddressId, setEditingAddressId] = useState('')
  /** IDs com ação (definir padrão/excluir) em andamento — desabilita os botões da linha. */
  const [pendingAddressIds, setPendingAddressIds] = useState<Set<string>>(new Set())

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

  const [isCepLookupPending, setIsCepLookupPending] = useState(false)
  const [isCepNotFound, setIsCepNotFound] = useState(false)

  const onAddressFormChange = (patch: Partial<AddressDraft>) => {
    if (patch.cep !== undefined) setIsCepNotFound(false)
    setAddressForm((prev) => ({
      ...prev,
      ...patch,
      // A máscara mora no estado, não no input: assim o valor validado e o
      // valor exibido são o mesmo.
      ...(patch.cep === undefined ? {} : { cep: formatCep(patch.cep) }),
    }))
  }

  // Autopreenchimento por CEP (ViaCEP): dispara quando o CEP fica completo
  // (8 dígitos). Cidade/UF vêm da base oficial e sobrescrevem; a rua só é
  // sugerida se o campo ainda está vazio (não apaga o que a pessoa digitou).
  // Falha de rede/CEP inexistente degrada em silêncio — a busca é
  // conveniência, os campos continuam editáveis à mão.
  const lookupCepDigits = addressForm.cep.replace(/\D/g, '')
  useEffect(() => {
    if (!isCompleteCep(lookupCepDigits)) return
    let cancelled = false
    setIsCepLookupPending(true)
    setIsCepNotFound(false)
    void lookupCep(lookupCepDigits)
      .then((found) => {
        if (cancelled) return
        if (!found) {
          setIsCepNotFound(true)
          return
        }
        setAddressForm((prev) => ({
          ...prev,
          city: found.city || prev.city,
          state: found.state || prev.state,
          neighborhood: found.neighborhood || prev.neighborhood,
          street: prev.street.trim() ? prev.street : found.street,
        }))
      })
      .finally(() => {
        if (!cancelled) setIsCepLookupPending(false)
      })
    return () => {
      cancelled = true
    }
  }, [lookupCepDigits])

  /** Abre o form CEP-first preenchido para editar — mesmo form do cadastro. */
  const onEditAddress = (address: Address) => {
    setEditingAddressId(address.id)
    setAddressError('')
    setAddressForm({
      label: address.label,
      street: address.street,
      number: address.number ?? '',
      complement: address.complement ?? '',
      neighborhood: address.neighborhood ?? '',
      city: address.city,
      state: address.state ?? '',
      cep: address.cep,
    })
  }

  const onCancelEditAddress = () => {
    setEditingAddressId('')
    setAddressError('')
    setAddressForm(EMPTY_ADDRESS)
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
      if (editingAddressId) {
        const { address } = await api.updateAddress(editingAddressId, {
          label: validated.label,
          street: validated.street,
          number: validated.number || undefined,
          complement: validated.complement || undefined,
          neighborhood: validated.neighborhood || undefined,
          city: validated.city,
          state: validated.state,
          zipCode: validated.cep,
        })
        setAddressError('')
        setAddresses((prev) =>
          prev.map((item) => (item.id === address.id ? toViewAddress(address) : item)),
        )
        setEditingAddressId('')
        setAddressForm(EMPTY_ADDRESS)
        pushToast('Endereço atualizado', 'success')
        return
      }

      const { address } = await api.createAddress({
        label: validated.label,
        street: validated.street,
        number: validated.number || undefined,
        complement: validated.complement || undefined,
        neighborhood: validated.neighborhood || undefined,
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
          : editingAddressId
            ? 'Não foi possível atualizar o endereço. Tente novamente.'
            : 'Não foi possível salvar o endereço. Tente novamente.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const withPending = async (id: string, action: () => Promise<void>) => {
    setPendingAddressIds((prev) => new Set(prev).add(id))
    try {
      await action()
    } finally {
      setPendingAddressIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const onSetDefaultAddress = (id: string) =>
    withPending(id, async () => {
      try {
        const { address } = await api.setDefaultAddress(id)
        setAddresses((prev) =>
          prev.map((item) =>
            item.id === address.id ? toViewAddress(address) : { ...item, isDefault: false },
          ),
        )
        pushToast('Endereço padrão atualizado', 'success')
      } catch (err) {
        pushToast(
          err instanceof ApiError && err.status > 0
            ? err.message
            : 'Não foi possível definir o endereço padrão. Tente novamente.',
          'error',
        )
      }
    })

  const onDeleteAddress = (id: string) =>
    withPending(id, async () => {
      try {
        await api.deleteAddress(id)
        setAddresses((prev) => prev.filter((item) => item.id !== id))
        if (editingAddressId === id) onCancelEditAddress()
        pushToast('Endereço excluído', 'success')
        // O DELETE promove o próximo padrão no servidor sem devolvê-lo no
        // corpo da resposta — recarrega para a lista refletir o novo padrão.
        retry()
      } catch (err) {
        pushToast(
          err instanceof ApiError && err.status > 0
            ? err.message
            : 'Não foi possível excluir o endereço. Tente novamente.',
          'error',
        )
      }
    })

  return {
    addresses,
    setAddresses,
    addressForm,
    setAddressForm,
    addressError,
    setAddressError,
    isCepLookupPending,
    isCepNotFound,
    isLoading,
    loadError,
    retry,
    selectedAddressId,
    setSelectedAddressId,
    defaultAddress: getDefaultAddress(addresses),
    onAddressFormChange,
    onAddressSubmit,
    isSubmitting,
    editingAddressId,
    onEditAddress,
    onCancelEditAddress,
    onSetDefaultAddress,
    onDeleteAddress,
    pendingAddressIds,
  }
}
