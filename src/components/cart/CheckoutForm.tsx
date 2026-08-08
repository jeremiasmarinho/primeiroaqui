import type { Address, DeliveryForm } from '../../types'
import AddressPicker from './AddressPicker'
import CartOrderSummary from './CartOrderSummary'
import DeliveryFields from './DeliveryFields'
import GiftOptionField from './GiftOptionField'

interface CheckoutFormProps {
  itemsCount: number
  subtotal: number
  discount: number
  total: number
  deliveryForm: DeliveryForm
  checkoutError: string
  couponCode: string
  couponError: string
  addresses: Address[]
  selectedAddressId: string
  /** Se a loja do carrinho oferece embalagem para presente (Item 9) — controla o toggle "É um presente?". */
  storeGiftWrapAvailable: boolean
  onSelectAddress: (id: string) => void
  onDeliveryChange: (patch: Partial<DeliveryForm>) => void
  onCouponCodeChange: (code: string) => void
  onApplyCoupon: () => void
  onRemoveCoupon: () => void
  onConfirm: () => void
  isConfirming?: boolean
}

/** Corpo do passo "entrega": resumo do pedido, cupom, dados e confirmação. */
export default function CheckoutForm({
  itemsCount,
  subtotal,
  discount,
  total,
  deliveryForm,
  checkoutError,
  addresses,
  selectedAddressId,
  storeGiftWrapAvailable,
  onSelectAddress,
  onDeliveryChange,
  onConfirm,
  isConfirming = false,
}: CheckoutFormProps) {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-surface to-surface-page p-4">
      <CartOrderSummary itemsCount={itemsCount} subtotal={subtotal} discount={discount} total={total} />

      {/* Cupom OCULTO no MVP: o desconto era so client-side (state/coupons.ts) e o
          servidor recalcula o total real no POST /orders — o cliente veria um valor
          que o pedido nao honra. Religar quando houver cupom no backend. */}

      <AddressPicker
        addresses={addresses}
        selectedAddressId={selectedAddressId}
        onSelectAddress={onSelectAddress}
      />

      <GiftOptionField
        storeGiftWrapAvailable={storeGiftWrapAvailable}
        deliveryForm={deliveryForm}
        onDeliveryChange={onDeliveryChange}
      />

      <DeliveryFields deliveryForm={deliveryForm} onDeliveryChange={onDeliveryChange} />

      {checkoutError ? (
        <p role="alert" className="rounded-[16px] bg-error/10 px-3 py-2 text-sm font-semibold text-error">
          {checkoutError}
        </p>
      ) : null}

      <div className="rounded-[24px] border border-success/30 bg-success/10 p-4 text-sm text-success">
        <p className="font-black">Entrega prevista em até 2 horas</p>
        <p className="mt-1 text-ink-muted">Pagamento confirmado via {deliveryForm.payment} após a confirmação.</p>
      </div>

      <button
        type="button"
        onClick={onConfirm}
        disabled={isConfirming}
        aria-busy={isConfirming}
        className="btn-primary min-h-[48px] w-full rounded-[20px] motion-safe:active:scale-[0.98]
                   disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isConfirming ? 'Confirmando…' : 'Confirmar compra'}
      </button>
    </div>
  )
}
