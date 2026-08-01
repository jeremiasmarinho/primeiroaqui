import { formatCurrency } from '../../lib/format'

interface CartOrderSummaryProps {
  itemsCount: number
  subtotal: number
  discount: number
  total: number
}

/** Caixa de resumo do pedido exibida no passo de entrega. */
export default function CartOrderSummary({ itemsCount, subtotal, discount, total }: CartOrderSummaryProps) {
  return (
    <div className="rounded-[24px] bg-slate-950 p-4 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Resumo do pedido</p>
      <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
        <span>Itens</span>
        <span className="tabular">{itemsCount}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm text-slate-300">
        <span>Subtotal</span>
        <span className="tabular">{formatCurrency(subtotal)}</span>
      </div>
      {discount > 0 && (
        <div className="mt-1 flex items-center justify-between text-sm text-emerald-400">
          <span>Desconto</span>
          <span className="tabular">-{formatCurrency(discount)}</span>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-sm">
        <span>Total</span>
        <span className="tabular font-black text-white">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}
