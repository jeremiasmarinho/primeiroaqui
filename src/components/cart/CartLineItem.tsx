import { Minus, Plus, Trash2 } from 'lucide-react'
import { formatCurrency } from '../../lib/format'
import { getLineSubtotal, MAX_QUANTITY_PER_ITEM } from '../../state/cart'
import type { CartItem } from '../../types'

interface CartLineItemProps {
  item: CartItem
  onIncrement: (productId: number) => void
  onDecrement: (productId: number) => void
  onRemove: (productId: number) => void
}

/**
 * Uma linha do carrinho com controles de quantidade (44px de alvo) e
 * `aria-label` descritivo: um `+` sozinho não diz ao leitor de tela de que
 * produto se trata.
 */
export default function CartLineItem({ item, onIncrement, onDecrement, onRemove }: CartLineItemProps) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display font-bold leading-snug text-slate-950">{item.product.title}</p>
          <p className="text-sm text-slate-500">{formatCurrency(item.product.price)} cada</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.product.id)}
          aria-label={`Remover ${item.product.title} do carrinho`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-50 text-red-600"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-full border border-slate-200">
          <button
            type="button"
            onClick={() => onDecrement(item.product.id)}
            aria-label={`Diminuir quantidade de ${item.product.title}`}
            className="grid h-11 w-11 place-items-center rounded-full text-slate-700 transition-colors duration-150 hover:bg-slate-100"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <span
            aria-live="polite"
            className="tabular min-w-[2ch] text-center text-sm font-bold text-slate-900"
          >
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => onIncrement(item.product.id)}
            disabled={item.quantity >= MAX_QUANTITY_PER_ITEM}
            aria-label={`Aumentar quantidade de ${item.product.title}`}
            className="grid h-11 w-11 place-items-center rounded-full text-slate-700 transition-colors duration-150 hover:bg-slate-100 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <span className="tabular font-black text-slate-900">{formatCurrency(getLineSubtotal(item))}</span>
      </div>
    </div>
  )
}
