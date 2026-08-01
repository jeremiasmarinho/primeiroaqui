import { ShoppingCart } from 'lucide-react'
import { formatCurrency } from '../../lib/format'
import type { CartState } from '../../types'
import CartLineItem from './CartLineItem'

interface CartItemsStepProps {
  cartState: CartState
  itemsCount: number
  subtotal: number
  onClose: () => void
  onIncrement: (productId: number) => void
  onDecrement: (productId: number) => void
  onRemove: (productId: number) => void
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
      <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-white to-slate-50 p-4">
        {itemsCount === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center">
            <ShoppingCart className="mx-auto h-9 w-9 text-slate-300" aria-hidden="true" />
            <p className="mt-3 font-bold text-slate-900">Seu carrinho está vazio</p>
            <p className="mt-1 text-sm text-slate-500">Adicione produtos da vitrine para continuar.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 min-h-[44px] rounded-full bg-slate-900 px-5 text-sm font-bold text-white"
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

      <div className="border-t border-slate-200 bg-white p-4">
        <div className="rounded-[20px] bg-slate-950 p-4 text-white">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Subtotal</span>
            <span className="tabular">{formatCurrency(subtotal)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm text-slate-300">
            <span>Entrega</span>
            <span>Calculada no próximo passo</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onContinue}
          disabled={itemsCount === 0}
          className="mt-3 min-h-[48px] w-full rounded-[20px] bg-emerald-600 px-4 font-bold text-white transition-transform duration-150 disabled:cursor-not-allowed disabled:opacity-40 motion-safe:active:scale-[0.98]"
        >
          Continuar
        </button>
      </div>
    </>
  )
}
