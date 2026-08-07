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
    <div className="rounded-[24px] border border-line bg-surface p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">Resumo do pedido</p>
      <div className="mt-3 flex items-center justify-between text-sm text-ink-muted">
        <span>Itens</span>
        <span className="tabular">{itemsCount}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm text-ink-muted">
        <span>Subtotal</span>
        <span className="tabular">{formatCurrency(subtotal)}</span>
      </div>
      {discount > 0 && (
        <div className="mt-1 flex items-center justify-between text-sm text-success">
          <span>Desconto</span>
          <span className="tabular">-{formatCurrency(discount)}</span>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-sm">
        <span className="text-ink-muted">Total</span>
        <span className="tabular font-display font-black text-ink">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}
