import { Link } from 'wouter'

import { ROUTES } from '../../router/routes'
import { formatAddressLine } from '../../state/addresses'
import type { Address } from '../../types'

interface AddressPickerProps {
  addresses: Address[]
  selectedAddressId: string
  onSelectAddress: (id: string) => void
}

/**
 * Escolha do endereço salvo dentro do checkout.
 *
 * Sem endereço salvo a seção não finge existir: mostra o convite para
 * cadastrar. Escolher um endereço preenche rua, cidade e CEP do formulário de
 * entrega — os campos continuam editáveis para o caso pontual.
 */
export default function AddressPicker({
  addresses,
  selectedAddressId,
  onSelectAddress,
}: AddressPickerProps) {
  if (addresses.length === 0) {
    return (
      <div className="rounded-[16px] border border-dashed border-line p-3">
        <p className="text-sm font-semibold text-ink">Nenhum endereço salvo ainda</p>
        <p className="mt-1 text-sm text-ink-muted">
          Salve um endereço para o checkout preencher a entrega nas próximas compras.
        </p>
        <Link
          href={ROUTES.addresses}
          className="btn-primary min-h-[44px] mt-2"
        >
          Cadastrar endereço
        </Link>
      </div>
    )
  }

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">Endereço de entrega</legend>
      <div className="mt-2 grid gap-2">
        {addresses.map((address) => (
          <label
            key={address.id}
            htmlFor={`entrega-${address.id}`}
            className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[16px] border px-3 py-2 transition-colors duration-150 ${
              selectedAddressId === address.id
                ? 'border-primary bg-primary/10'
                : 'border-line hover:border-primary/40'
            }`}
          >
            <input
              type="radio"
              id={`entrega-${address.id}`}
              name="endereco-entrega"
              value={address.id}
              checked={selectedAddressId === address.id}
              onChange={() => onSelectAddress(address.id)}
              className="h-5 w-5 shrink-0 accent-primary"
            />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink">{address.label}</span>
              <span className="block truncate text-xs text-ink-muted">
                {formatAddressLine(address)}
              </span>
            </span>
          </label>
        ))}
      </div>

      <Link
        href={ROUTES.addresses}
        className="mt-2 inline-flex min-h-[44px] items-center text-sm font-bold text-primary-active underline"
      >
        Gerenciar endereços
      </Link>
    </fieldset>
  )
}
