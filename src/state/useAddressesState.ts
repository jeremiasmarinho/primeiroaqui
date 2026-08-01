import { useState } from 'react'

import { readStoredJSON } from '../lib/storage'
import {
  EMPTY_ADDRESS,
  createAddress,
  createAddressIdGenerator,
  formatCep,
  getDefaultAddress,
  removeAddress,
  setDefaultAddress,
  type AddressDraft,
} from './addresses'
import { STORAGE_KEYS } from './session'
import type { Address } from '../types'

/**
 * Valida o formato lido do storage: JSON válido com shape errado não pode
 * vazar para a UI (regressão B8).
 */
const isAddressList = (value: unknown): value is Address[] =>
  Array.isArray(value) &&
  value.every((item) => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as Partial<Address>
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.label === 'string' &&
      typeof candidate.street === 'string' &&
      typeof candidate.city === 'string' &&
      typeof candidate.cep === 'string'
    )
  })

/** Endereços salvos, formulário de cadastro e escolha do checkout. */
export function useAddressesState() {
  const [addresses, setAddresses] = useState<Address[]>(() =>
    readStoredJSON<Address[]>(STORAGE_KEYS.addresses, [], isAddressList),
  )
  const [addressForm, setAddressForm] = useState<AddressDraft>(EMPTY_ADDRESS)
  const [addressError, setAddressError] = useState('')
  const [selectedAddressId, setSelectedAddressId] = useState('')

  const onAddressFormChange = (patch: Partial<AddressDraft>) => {
    setAddressForm((prev) => ({
      ...prev,
      ...patch,
      // A máscara mora no estado, não no input: assim o valor validado e o
      // valor exibido são o mesmo.
      ...(patch.cep === undefined ? {} : { cep: formatCep(patch.cep) }),
    }))
  }

  const onAddressSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const result = createAddress(addresses, addressForm, {
      idGenerator: createAddressIdGenerator(addresses),
    })

    if (!result.ok) {
      setAddressError(result.message)
      return
    }

    setAddressError('')
    setAddresses(result.addresses)
    setAddressForm(EMPTY_ADDRESS)
  }

  return {
    addresses,
    setAddresses,
    addressForm,
    setAddressForm,
    addressError,
    setAddressError,
    selectedAddressId,
    setSelectedAddressId,
    defaultAddress: getDefaultAddress(addresses),
    onAddressFormChange,
    onAddressSubmit,
    onSetDefaultAddress: (id: string) => setAddresses((prev) => setDefaultAddress(prev, id)),
    onRemoveAddress: (id: string) => setAddresses((prev) => removeAddress(prev, id)),
  }
}
