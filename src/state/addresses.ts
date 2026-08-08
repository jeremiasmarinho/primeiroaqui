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
  number: string
  complement: string
  city: string
  /** UF — exigido pelo POST /api/addresses (zod `state` min 1). */
  state: string
  cep: string
}

export const EMPTY_ADDRESS: AddressDraft = {
  label: '',
  street: '',
  number: '',
  complement: '',
  city: '',
  state: '',
  cep: '',
}

export type AddressRejection =
  | 'rotulo-obrigatorio'
  | 'rua-obrigatoria'
  | 'cidade-obrigatoria'
  | 'estado-obrigatorio'
  | 'cep-invalido'
  | 'complemento-obrigatorio'
  | 'duplicado'

export type AddressResult =
  | { ok: true; addresses: Address[]; created: Address }
  | { ok: false; reason: AddressRejection; message: string }

const MESSAGES: Record<AddressRejection, string> = {
  'rotulo-obrigatorio': 'Dê um nome ao endereço, como "Casa" ou "Trabalho".',
  'rua-obrigatoria': 'Informe a rua e o número da entrega.',
  'cidade-obrigatoria': 'Informe a cidade da entrega.',
  'estado-obrigatorio': 'Informe o estado (UF) da entrega.',
  'cep-invalido': CEP_ERROR_MESSAGE,
  'complemento-obrigatorio': 'Sem número? Descreva um complemento/referência para o entregador achar o endereço.',
  duplicado: 'Este endereço já está salvo na sua lista.',
}

const reject = (reason: AddressRejection): { ok: false; reason: AddressRejection; message: string } => ({
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

export type DraftValidation =
  | {
      ok: true
      label: string
      street: string
      number: string
      complement: string
      city: string
      state: string
      cep: string
    }
  | { ok: false; reason: AddressRejection; message: string }

/**
 * Validação pura do rascunho, compartilhada entre o fluxo local (testes,
 * fallback) e o POST real em `useAddressesState` — a regra é uma só.
 *
 * Regra de negócio pedida pelo usuário: número presente → complemento
 * opcional; sem número (ex. casa s/n) → complemento obrigatório, para o
 * entregador conseguir achar o endereço. Mesma regra do lado do servidor
 * (zod `refine` em src/server/routes/addresses.ts).
 */
export const validateAddressDraft = (draft: AddressDraft): DraftValidation => {
  const label = draft.label.trim()
  const street = draft.street.trim()
  const number = draft.number.trim()
  const complement = draft.complement.trim()
  const city = draft.city.trim()
  const state = draft.state.trim()

  if (!label) return reject('rotulo-obrigatorio')
  if (!street) return reject('rua-obrigatoria')
  if (!city) return reject('cidade-obrigatoria')
  if (!state) return reject('estado-obrigatorio')
  if (!isValidCep(draft.cep)) return reject('cep-invalido')
  if (!number && !complement) return reject('complemento-obrigatorio')

  return { ok: true, label, street, number, complement, city, state, cep: formatCep(draft.cep) }
}

export const createAddress = (
  list: Address[],
  draft: AddressDraft,
  { idGenerator }: CreateAddressOptions,
): AddressResult => {
  const validated = validateAddressDraft(draft)
  if (!validated.ok) return validated
  const { label, street, number, complement, city, cep } = validated
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
    number: number || undefined,
    complement: complement || undefined,
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
  address: formatAddress(address),
  city: address.city,
  cep: address.cep,
})

/**
 * "Rua X, 123 - Apto 4" a partir dos campos separados. Endereços legados
 * (cadastrados antes do campo `number` existir) não têm número nem
 * complemento — exibem como estavam, sem quebrar.
 */
export const formatAddress = (address: Address): string => {
  const parts = [address.street]
  if (address.number) parts.push(address.number)
  let line = parts.join(', ')
  if (address.complement) line += ` - ${address.complement}`
  return line
}

/** @deprecated use `formatAddress` — mantido por compatibilidade de import. */
export const formatAddressLine = (address: Address): string => formatAddress(address)
