import type { Address, DeliveryForm } from '../types'

/**
 * Endereços da pessoa: cadastro, padrão e validação de CEP.
 *
 * Lógica pura — nenhum acesso a storage, a React ou ao relógio. O gerador de
 * ID entra por parâmetro pelo mesmo motivo de `state/orders`: sem isso o teste
 * dependeria de `Math.random()` e a suíte deixaria de ser determinística.
 */

export const CEP_LENGTH = 8
export const CEP_MASK = '00000-000'
export const CEP_ERROR_MESSAGE = `Informe um cep valido no formato ${CEP_MASK} (8 digitos).`

const onlyDigits = (raw: string): string => raw.replace(/\D/g, '')

/** Máscara progressiva: aplica o hífen só depois do quinto dígito. */
export const formatCep = (raw: string): string => {
  const digits = onlyDigits(raw).slice(0, CEP_LENGTH)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

/**
 * Aceita `00000-000` e `00000000`. Espaço no meio ou dígito a mais reprova:
 * CEP tem formato fechado, e ser permissivo aqui empurra o erro para a entrega.
 */
export const isValidCep = (raw: string): boolean =>
  onlyDigits(raw).length === CEP_LENGTH && /^\d{5}-?\d{3}$/.test(raw.trim())

export interface AddressDraft {
  label: string
  street: string
  city: string
  cep: string
}

export const EMPTY_ADDRESS: AddressDraft = { label: '', street: '', city: '', cep: '' }

export type AddressRejection =
  | 'rotulo-obrigatorio'
  | 'rua-obrigatoria'
  | 'cidade-obrigatoria'
  | 'cep-invalido'
  | 'duplicado'

export type AddressResult =
  | { ok: true; addresses: Address[]; created: Address }
  | { ok: false; reason: AddressRejection; message: string }

const MESSAGES: Record<AddressRejection, string> = {
  'rotulo-obrigatorio': 'Dê um nome ao endereço, como "Casa" ou "Trabalho".',
  'rua-obrigatoria': 'Informe a rua e o número da entrega.',
  'cidade-obrigatoria': 'Informe a cidade da entrega.',
  'cep-invalido': CEP_ERROR_MESSAGE,
  duplicado: 'Este endereço já está salvo na sua lista.',
}

const reject = (reason: AddressRejection): AddressResult => ({
  ok: false,
  reason,
  message: MESSAGES[reason],
})

const idNumber = (id: string): number => {
  const parsed = Number.parseInt(id.replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

export const createAddressIdGenerator = (
  existing: Pick<Address, 'id'>[],
): (() => string) => {
  let current = existing.reduce((max, item) => Math.max(max, idNumber(item.id)), 0)

  return () => {
    current += 1
    return `end-${current}`
  }
}

export interface CreateAddressOptions {
  idGenerator: () => string
}

export const createAddress = (
  list: Address[],
  draft: AddressDraft,
  { idGenerator }: CreateAddressOptions,
): AddressResult => {
  const label = draft.label.trim()
  const street = draft.street.trim()
  const city = draft.city.trim()

  if (!label) return reject('rotulo-obrigatorio')
  if (!street) return reject('rua-obrigatoria')
  if (!city) return reject('cidade-obrigatoria')
  if (!isValidCep(draft.cep)) return reject('cep-invalido')

  const cep = formatCep(draft.cep)
  const alreadySaved = list.some(
    (item) =>
      item.street.toLowerCase() === street.toLowerCase() &&
      item.city.toLowerCase() === city.toLowerCase() &&
      item.cep === cep,
  )
  if (alreadySaved) return reject('duplicado')

  // O primeiro endereço vira padrão sozinho: lista com um item e nenhum padrão
  // deixaria o checkout sem sugestão logo depois do cadastro.
  const created: Address = {
    id: idGenerator(),
    label,
    street,
    city,
    cep,
    isDefault: list.length === 0,
  }

  return { ok: true, addresses: [...list, created], created }
}

export const setDefaultAddress = (list: Address[], id: string): Address[] => {
  if (!list.some((item) => item.id === id)) return list
  return list.map((item) => ({ ...item, isDefault: item.id === id }))
}

/** Remover o padrão promove o próximo — a lista nunca fica sem sugestão. */
export const removeAddress = (list: Address[], id: string): Address[] => {
  const remaining = list.filter((item) => item.id !== id)
  if (remaining.length === 0 || remaining.some((item) => item.isDefault)) return remaining

  return remaining.map((item, index) => (index === 0 ? { ...item, isDefault: true } : item))
}

export const getDefaultAddress = (list: Address[]): Address | null =>
  list.find((item) => item.isDefault) ?? list[0] ?? null

export const addressToDeliveryPatch = (
  address: Address,
): Pick<DeliveryForm, 'address' | 'city' | 'cep'> => ({
  address: address.street,
  city: address.city,
  cep: address.cep,
})

export const formatAddressLine = (address: Address): string =>
  `${address.street}, ${address.city}`
