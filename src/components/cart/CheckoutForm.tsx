import type { Address, DeliveryForm } from '../../types'
import AddressPicker from './AddressPicker'
import CartOrderSummary from './CartOrderSummary'
import CouponField from './CouponField'
import DeliveryFields from './DeliveryFields'

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
  onSelectAddress: (id: string) => void
  onDeliveryChange: (patch: Partial<DeliveryForm>) => void
  onCouponCodeChange: (code: string) => void
  onApplyCoupon: () => void
  onRemoveCoupon: () => void
  onConfirm: () => void
}

/** Corpo do passo "entrega": resumo do pedido, cupom, dados e confirmação. */
export default function CheckoutForm({
  itemsCount,
  subtotal,
  discount,
  total,
  deliveryForm,
  checkoutError,
  couponCode,
  couponError,
  addresses,
  selectedAddressId,
  onSelectAddress,
  onDeliveryChange,
  onCouponCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
  onConfirm,
}: CheckoutFormProps) {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-white to-slate-50 p-4">
      <CartOrderSummary itemsCount={itemsCount} subtotal={subtotal} discount={discount} total={total} />

      <CouponField
        couponCode={couponCode}
        couponError={couponError}
        discount={discount}
        onCouponCodeChange={onCouponCodeChange}
        onApplyCoupon={onApplyCoupon}
        onRemoveCoupon={onRemoveCoupon}
      />

      <AddressPicker
        addresses={addresses}
        selectedAddressId={selectedAddressId}
        onSelectAddress={onSelectAddress}
      />

      <DeliveryFields deliveryForm={deliveryForm} onDeliveryChange={onDeliveryChange} />

      {checkoutError ? (
        <p role="alert" className="rounded-[16px] bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {checkoutError}
        </p>
      ) : null}

      <div className="rounded-[24px] border border-green-200 bg-green-50 p-4 text-sm text-green-700">
        <p className="font-black">Entrega prevista em até 2 horas</p>
        <p className="mt-1">Pagamento confirmado via {deliveryForm.payment} após a confirmação.</p>
      </div>

      <button
        type="button"
        onClick={onConfirm}
        className="min-h-[48px] w-full rounded-[20px] bg-emerald-600 px-4 font-bold text-white transition-transform duration-150 motion-safe:active:scale-[0.98]"
      >
        Confirmar compra
      </button>
    </div>
  )
}
