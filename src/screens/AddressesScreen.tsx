import { MapPin } from 'lucide-react'

import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  ScreenHeader,
  itemsLabel,
} from '../components/ScreenShell'
import type { AddressDraft } from '../state/addresses'
import type { Address } from '../types'

interface AddressesScreenProps {
  addresses: Address[]
  addressForm: AddressDraft
  addressError: string
  onAddressFormChange: (patch: Partial<AddressDraft>) => void
  onAddressSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  isLoading?: boolean
  error?: string
}

const FIELDS = [
  { id: 'endereco-rotulo', label: 'Nome do endereço', key: 'label', autoComplete: 'off' },
  { id: 'endereco-rua', label: 'Rua e número', key: 'street', autoComplete: 'street-address' },
  { id: 'endereco-cidade', label: 'Cidade', key: 'city', autoComplete: 'address-level2' },
  { id: 'endereco-estado', label: 'Estado (UF)', key: 'state', autoComplete: 'address-level1' },
] as const

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
}: AddressesScreenProps) {
  const form = (
    <form onSubmit={onAddressSubmit} className="rounded-card bg-surface p-4 shadow-card">
      <h2 className="font-display text-base font-bold text-ink">Novo endereço</h2>

      <div className="mt-3 space-y-3">
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
            onChange={(event) => onAddressFormChange({ cep: event.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      {addressError ? (
        <p role="alert" className="mt-3 text-sm font-bold text-promo">
          {addressError}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn-primary min-h-[44px] mt-4 min-h-[48px] w-full motion-safe:active:scale-[0.98]"
      >
        Salvar endereço
      </button>
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
        {addresses.map((address) => (
          <li key={address.id} className="rounded-card bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display font-bold text-ink">{address.label}</p>
              {address.isDefault ? (
                <span className="rounded-full bg-brand px-2 py-0.5 text-micro font-bold uppercase tracking-wide text-navy">
                  Padrão
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-ink-muted">{address.street}</p>
            <p className="text-sm text-ink-muted">{address.city}</p>
            <p className="tabular text-sm text-ink-faint">{address.cep}</p>

            {/* Remover/definir padrão saíram nesta fase: a API só expõe
                POST e GET de endereços — botão que finge funcionar é pior
                do que ausência (pendência da fase de conta). */}
          </li>
        ))}
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
