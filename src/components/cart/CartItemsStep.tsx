import { ShoppingCart } from 'lucide-react'
import { formatCurrency } from '../../lib/format'
import type { CartState } from '../../types'
import CartLineItem from './CartLineItem'

interface CartItemsStepProps {
  cartState: CartState
  itemsCount: number
  subtotal: number
  onClose: () => void
  onIncrement: (productId: string) => void
  onDecrement: (productId: string) => void
  onRemove: (productId: string) => void
  onContinue: () => void
}

/** Corpo do passo "carrinho": lista de itens, subtotal e ação de continuar. */
export default function CartItemsStep({
  cartState,
  itemsCount,
  subtotal,
  onClose,
  onIncrement,
  onDecrement,
  onRemove,
  onContinue,
}: CartItemsStepProps) {
  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-surface to-surface-page p-4">
        {itemsCount === 0 ? (
          <div className="rounded-[24px] border border-dashed border-line bg-surface p-8 text-center">
            <ShoppingCart className="mx-auto h-9 w-9 text-ink-faint" aria-hidden="true" />
            <p className="mt-3 font-bold text-ink">Seu carrinho está vazio</p>
            <p className="mt-1 text-sm text-ink-muted">Adicione produtos da vitrine para continuar.</p>
            <button
              type="button"
              onClick={onClose}
              className="btn-primary min-h-[44px] mt-4"
            >
              Ver ofertas
            </button>
          </div>
        ) : (
          cartState.items.map((item) => (
            <CartLineItem
              key={item.product.id}
              item={item}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              onRemove={onRemove}
            />
          ))
        )}
      </div>

      <div className="border-t border-line bg-surface p-4">
        <div className="rounded-[20px] border border-line bg-surface-sunken p-4">
          <div className="flex items-center justify-between text-sm text-ink-muted">
            <span>Subtotal</span>
            <span className="tabular">{formatCurrency(subtotal)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm text-ink-muted">
            <span>Entrega</span>
            <span>Calculada no próximo passo</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onContinue}
          disabled={itemsCount === 0}
          className="btn-primary mt-3 min-h-[48px] w-full rounded-[20px] disabled:cursor-not-allowed disabled:opacity-40 motion-safe:active:scale-[0.98]"
        >
          Continuar
        </button>
      </div>
    </>
  )
}
