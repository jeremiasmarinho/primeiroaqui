import { Briefcase, Home, MapPin, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  ScreenHeader,
  itemsLabel,
} from '../components/ScreenShell'
import { formatAddress, type AddressDraft } from '../state/addresses'
import type { Address } from '../types'

interface AddressesScreenProps {
  addresses: Address[]
  addressForm: AddressDraft
  addressError: string
  onAddressFormChange: (patch: Partial<AddressDraft>) => void
  onAddressSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  isLoading?: boolean
  error?: string
  isSubmitting?: boolean
  /** Busca de endereço por CEP (ViaCEP) em andamento — mostra o hint no campo. */
  isCepLookupPending?: boolean
  /** CEP consultado e não encontrado — libera preenchimento manual. */
  isCepNotFound?: boolean
  /** ID do endereço em edição — vazio = form em modo cadastro. */
  editingAddressId?: string
  onEditAddress?: (address: Address) => void
  onCancelEditAddress?: () => void
  onSetDefaultAddress?: (id: string) => void
  onDeleteAddress?: (id: string) => void
  /** IDs com ação (definir padrão/excluir) em andamento — desabilita os botões da linha. */
  pendingAddressIds?: Set<string>
}

const DELETE_CONFIRM_WINDOW_MS = 4000

// CEP é o primeiro campo: a busca automática preenche rua/bairro/cidade/UF,
// então o número (o que o CEP não traz) vem logo em seguida, e o rótulo por
// último.
const FIELDS = [
  { id: 'endereco-rua', label: 'Rua', key: 'street', autoComplete: 'street-address' },
  { id: 'endereco-bairro', label: 'Bairro', key: 'neighborhood', autoComplete: 'address-level3' },
  { id: 'endereco-cidade', label: 'Cidade', key: 'city', autoComplete: 'address-level2' },
  { id: 'endereco-estado', label: 'Estado (UF)', key: 'state', autoComplete: 'address-level1' },
] as const

/** Rótulos pré-definidos do endereço — "Outro" libera texto livre. */
const LABEL_PRESETS = ['Casa', 'Trabalho', 'Casa de parente'] as const
const LABEL_OTHER = 'Outro'

const LABEL_ICONS: Record<string, typeof Home> = {
  Casa: Home,
  Trabalho: Briefcase,
  'Casa de parente': Users,
}

const inputClass =
  'field-input mt-1'

/** Cadastro e gestão dos endereços de entrega. O CEP é mascarado no estado. */
export default function AddressesScreen({
  addresses,
  addressForm,
  addressError,
  onAddressFormChange,
  onAddressSubmit,
  isLoading = false,
  error = '',
  isSubmitting = false,
  isCepLookupPending = false,
  isCepNotFound = false,
  editingAddressId = '',
  onEditAddress,
  onCancelEditAddress,
  onSetDefaultAddress,
  onDeleteAddress,
  pendingAddressIds = new Set(),
}: AddressesScreenProps) {
  const numberInputRef = useRef<HTMLInputElement>(null)
  const wasLookupPending = useRef(false)
  // Confirmação inline (dois cliques) de exclusão — mesmo padrão de
  // AdminStoresTab, sem window.confirm (trava automação/testes).
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
    }
  }, [])

  const handleDeleteClick = (id: string) => {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id)
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
      deleteTimeoutRef.current = setTimeout(() => setPendingDeleteId(null), DELETE_CONFIRM_WINDOW_MS)
      return
    }
    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
    setPendingDeleteId(null)
    onDeleteAddress?.(id)
  }

  // Foco pula para o número assim que a busca de CEP termina (achado ou não)
  // — o número é o próximo dado que o CEP não traz.
  useEffect(() => {
    if (wasLookupPending.current && !isCepLookupPending) {
      numberInputRef.current?.focus()
    }
    wasLookupPending.current = isCepLookupPending
  }, [isCepLookupPending])

  const form = (
    <form onSubmit={onAddressSubmit} className="rounded-card bg-surface p-4 shadow-card">
      <h2 className="font-display text-base font-bold text-ink">
        {editingAddressId ? 'Editar endereço' : 'Novo endereço'}
      </h2>

      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor="endereco-cep" className="text-sm font-semibold text-ink-muted">
            CEP
          </label>
          <input
            id="endereco-cep"
            value={addressForm.cep}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            aria-busy={isCepLookupPending}
            onChange={(event) => onAddressFormChange({ cep: event.target.value })}
            className={inputClass}
          />
          {isCepLookupPending ? (
            <p role="status" className="mt-1 text-xs font-semibold text-ink-muted">
              Buscando endereço pelo CEP…
            </p>
          ) : null}
          {!isCepLookupPending && isCepNotFound ? (
            <p role="status" className="mt-1 text-xs font-semibold text-promo">
              CEP não encontrado. Preencha rua, cidade e estado manualmente.
            </p>
          ) : null}
        </div>

        {FIELDS.map((field) => (
          <div key={field.id}>
            <label htmlFor={field.id} className="text-sm font-semibold text-ink-muted">
              {field.label}
            </label>
            <input
              id={field.id}
              value={addressForm[field.key]}
              autoComplete={field.autoComplete}
              onChange={(event) => onAddressFormChange({ [field.key]: event.target.value })}
              className={inputClass}
            />
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="endereco-numero" className="text-sm font-semibold text-ink-muted">
              Número
            </label>
            <input
              id="endereco-numero"
              ref={numberInputRef}
              value={addressForm.number}
              autoComplete="off"
              inputMode="numeric"
              placeholder="s/n"
              onChange={(event) => onAddressFormChange({ number: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="endereco-complemento" className="text-sm font-semibold text-ink-muted">
              Complemento
            </label>
            <input
              id="endereco-complemento"
              value={addressForm.complement}
              autoComplete="off"
              placeholder="Apto, bloco, referência…"
              onChange={(event) => onAddressFormChange({ complement: event.target.value })}
              className={inputClass}
            />
          </div>
        </div>
        {!addressForm.number.trim() ? (
          <p className="text-xs text-ink-muted">
            Sem número? Descreva um complemento/referência para o entregador achar o endereço.
          </p>
        ) : null}

        <div>
          <label htmlFor="endereco-rotulo" className="text-sm font-semibold text-ink-muted">
            Nome do endereço
          </label>
          <select
            id="endereco-rotulo"
            value={
              (LABEL_PRESETS as readonly string[]).includes(addressForm.label)
                ? addressForm.label
                : LABEL_OTHER
            }
            onChange={(event) =>
              onAddressFormChange({
                label: event.target.value === LABEL_OTHER ? '' : event.target.value,
              })
            }
            className={inputClass}
          >
            {LABEL_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
            <option value={LABEL_OTHER}>{LABEL_OTHER}</option>
          </select>
          {!(LABEL_PRESETS as readonly string[]).includes(addressForm.label) ? (
            <>
              <label htmlFor="endereco-rotulo-outro" className="sr-only">
                Nome do endereço (outro)
              </label>
              <input
                id="endereco-rotulo-outro"
                value={addressForm.label}
                autoComplete="off"
                placeholder="Ex.: Sítio"
                onChange={(event) => onAddressFormChange({ label: event.target.value })}
                className={`${inputClass} mt-2`}
              />
            </>
          ) : null}
        </div>
      </div>

      {addressError ? (
        <p role="alert" className="mt-3 text-sm font-bold text-promo">
          {addressError}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="btn-primary min-h-[48px] flex-1 motion-safe:active:scale-[0.98]
                     disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting
            ? 'Salvando…'
            : editingAddressId
              ? 'Salvar alterações'
              : 'Salvar endereço'}
        </button>
        {editingAddressId ? (
          <button
            type="button"
            onClick={onCancelEditAddress}
            disabled={isSubmitting}
            className="min-h-[48px] rounded-full border border-line px-4 text-sm font-bold text-ink-muted
                       motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  )

  const list =
    addresses.length === 0 ? (
      <EmptyBlock
        Icon={MapPin}
        title="Nenhum endereço salvo"
        message="Cadastre um endereço para o checkout preencher a entrega sozinho."
      />
    ) : (
      <ul aria-label="Endereços salvos" className="grid gap-3">
        {addresses.map((address) => {
          const isPending = pendingAddressIds.has(address.id)
          const isConfirmingDelete = pendingDeleteId === address.id
          const LabelIcon = LABEL_ICONS[address.label]
          return (
            <li key={address.id} className="rounded-card bg-surface p-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 font-display font-bold text-ink">
                  {LabelIcon ? <LabelIcon className="h-4 w-4 text-ink-muted" aria-hidden="true" /> : null}
                  {address.label}
                </p>
                {address.isDefault ? (
                  <span className="rounded-full bg-brand px-2 py-0.5 text-micro font-bold uppercase tracking-wide text-navy">
                    Padrão
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-ink-muted">{formatAddress(address)}</p>
              <p className="text-sm text-ink-muted">{address.city}</p>
              <p className="tabular text-sm text-ink-faint">{address.cep}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onEditAddress?.(address)}
                  disabled={isPending}
                  className="min-h-[36px] rounded-full border border-line px-3 text-xs font-bold text-ink-muted
                             motion-safe:active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Editar
                </button>
                {!address.isDefault ? (
                  <button
                    type="button"
                    onClick={() => onSetDefaultAddress?.(address.id)}
                    disabled={isPending}
                    className="min-h-[36px] rounded-full border border-line px-3 text-xs font-bold text-ink-muted
                               motion-safe:active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? 'Salvando…' : 'Tornar padrão'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleDeleteClick(address.id)}
                  disabled={isPending}
                  className={`min-h-[36px] rounded-full px-3 text-xs font-bold motion-safe:active:scale-95
                              disabled:cursor-not-allowed disabled:opacity-60 ${
                                isConfirmingDelete
                                  ? 'border border-error bg-error text-white'
                                  : 'border border-line text-ink-muted'
                              }`}
                >
                  {isPending ? 'Excluindo…' : isConfirmingDelete ? 'Confirmar exclusão?' : 'Excluir'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    )

  const body = () => {
    if (isLoading) return <LoadingBlock label="Carregando seus endereços…" />
    if (error) return <ErrorBlock message={error} />
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {form}
        {list}
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-surface-page pb-8">
      <ScreenHeader title="Meus endereços" count={itemsLabel(addresses.length)} />
      <main className="mx-auto max-w-4xl px-3 py-4">{body()}</main>
    </div>
  )
}
