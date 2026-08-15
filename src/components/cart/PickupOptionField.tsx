import { MapPin } from 'lucide-react'

import type { DeliveryForm } from '../../types'

interface PickupOptionFieldProps {
  /** Se a loja do carrinho aceita retirada presencial — controla se a opção aparece. */
  storePickupAvailable: boolean
  /** Endereço físico da loja para retirada, quando cadastrado. */
  storePickupAddress?: string | null
  deliveryForm: DeliveryForm
  onDeliveryChange: (patch: Partial<DeliveryForm>) => void
}

/**
 * Toggle "Retirar na loja" do checkout (Item 14).
 *
 * Só aparece quando a loja do carrinho oferece retirada
 * (`storePickupAvailable`, derivado de `Store.pickupAvailable`). Marcado,
 * dispensa o endereço de entrega: o pedido vai com `pickupStoreIds` e o
 * backend grava `isPickup=true` com `addressId` nulo.
 */
export default function PickupOptionField({
  storePickupAvailable,
  storePickupAddress,
  deliveryForm,
  onDeliveryChange,
}: PickupOptionFieldProps) {
  if (!storePickupAvailable) return null

  return (
    <div className="rounded-[16px] border border-line p-3">
      <label htmlFor="retirar-na-loja" className="flex min-h-[44px] cursor-pointer items-center gap-3">
        <input
          id="retirar-na-loja"
          type="checkbox"
          checked={deliveryForm.isPickup}
          onChange={(event) => onDeliveryChange({ isPickup: event.target.checked })}
          className="h-5 w-5 shrink-0 accent-primary"
        />
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          Retirar na loja
        </span>
      </label>

      {deliveryForm.isPickup ? (
        <p className="mt-2 text-xs text-ink-muted">
          {storePickupAddress
            ? `Retire em: ${storePickupAddress}`
            : 'A loja combina o local de retirada com você após a confirmação.'}
        </p>
      ) : null}
    </div>
  )
}
