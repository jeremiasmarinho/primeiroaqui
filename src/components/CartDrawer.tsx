import { X } from 'lucide-react'
import { getCartItemsCount, getCartSubtotal } from '../state/cart'
import type { Address, CartState, DeliveryForm } from '../types'
import CartItemsStep from './cart/CartItemsStep'
import CheckoutForm from './cart/CheckoutForm'

export type CheckoutStep = 'cart' | 'delivery'

interface CartDrawerProps {
  open: boolean
  step: CheckoutStep
  cartState: CartState
  deliveryForm: DeliveryForm
  checkoutError: string
  couponCode: string
  couponError: string
  discount: number
  addresses: Address[]
  selectedAddressId: string
  onSelectAddress: (id: string) => void
  onClose: () => void
  onIncrement: (productId: string) => void
  onDecrement: (productId: string) => void
  onRemove: (productId: string) => void
  onDeliveryChange: (patch: Partial<DeliveryForm>) => void
  onCouponCodeChange: (code: string) => void
  onApplyCoupon: () => void
  onRemoveCoupon: () => void
  onContinue: () => void
  onConfirm: () => void
  isConfirming?: boolean
}

/**
 * Gaveta de carrinho e checkout em dois passos.
 *
 * O corpo de cada passo mora em subcomponentes (`CartItemsStep`,
 * `CheckoutForm`); esta casca só cuida do diálogo e do cabeçalho.
 */
export default function CartDrawer({
  open,
  step,
  cartState,
  deliveryForm,
  checkoutError,
  couponCode,
  couponError,
  discount,
  addresses,
  selectedAddressId,
  onSelectAddress,
  onClose,
  onIncrement,
  onDecrement,
  onRemove,
  onDeliveryChange,
  onCouponCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
  onContinue,
  onConfirm,
  isConfirming = false,
}: CartDrawerProps) {
  if (!open) return null

  const itemsCount = getCartItemsCount(cartState)
  const subtotal = getCartSubtotal(cartState)
  const total = Math.max(0, subtotal - discount)

  return (
    <div className="fixed inset-0 z-50 bg-ink/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={step === 'cart' ? 'Carrinho de compras' : 'Dados de entrega'}
        className="ml-auto flex h-full max-w-md flex-col overflow-hidden rounded-[32px] bg-surface shadow-[0_30px_80px_rgba(15,23,42,0.25)]"
      >
        <div className="flex items-center justify-between border-b border-navy/15 bg-brand p-4 text-navy">
          <div>
            <h2 className="font-display text-lg font-black">{step === 'cart' ? 'Carrinho' : 'Entrega'}</h2>
            <p className="text-sm text-navy/70">
              {step === 'cart' ? `${itemsCount} itens` : 'Complete os dados para o pedido'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar carrinho"
            className="grid h-11 w-11 place-items-center rounded-full bg-navy/10 text-navy transition-colors duration-150 hover:bg-navy/20"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {step === 'cart' ? (
          <CartItemsStep
            cartState={cartState}
            itemsCount={itemsCount}
            subtotal={subtotal}
            onClose={onClose}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            onRemove={onRemove}
            onContinue={onContinue}
          />
        ) : (
          <CheckoutForm
            itemsCount={itemsCount}
            subtotal={subtotal}
            discount={discount}
            total={total}
            deliveryForm={deliveryForm}
            checkoutError={checkoutError}
            couponCode={couponCode}
            couponError={couponError}
            addresses={addresses}
            selectedAddressId={selectedAddressId}
            onSelectAddress={onSelectAddress}
            onDeliveryChange={onDeliveryChange}
            onCouponCodeChange={onCouponCodeChange}
            onApplyCoupon={onApplyCoupon}
            onRemoveCoupon={onRemoveCoupon}
            onConfirm={onConfirm}
            isConfirming={isConfirming}
          />
        )}
      </div>
    </div>
  )
}
