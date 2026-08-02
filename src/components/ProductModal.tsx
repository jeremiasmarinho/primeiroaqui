import { X } from 'lucide-react'
import { formatCurrency } from '../lib/format'
import { fallbackTo } from '../lib/images'
import { discountPercent, storeBySeller } from '../data/catalog'
import ProductReviews from './ProductReviews'
import type { Product } from '../types'

interface ProductModalProps {
  product: Product | null
  onClose: () => void
  onAddToCart: (product: Product) => void
}

export default function ProductModal({ product, onClose, onAddToCart }: ProductModalProps) {
  if (!product) return null

  const off = discountPercent(product)
  const store = storeBySeller(product.seller)

  return (

        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 p-4">
          <div className="w-full max-w-2xl rounded-[28px] bg-surface p-4 shadow-2xl md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Detalhes do produto</p>
                <h3 className="mt-2 text-2xl font-black text-ink">{product.title}</h3>
              </div>
              <button onClick={() => onClose()} className="rounded-full bg-surface-sunken p-2"><X className="h-5 w-5 text-ink-muted" /></button>
            </div>
            <div className="mt-4 grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
              <img src={product.image} alt={product.title} onError={fallbackTo(product.title)} className="h-56 w-full rounded-[24px] object-cover" />
              <div>
                <p className="text-sm text-ink-muted">
                  {product.seller}
                  {store ? (
                    <span className="text-ink-faint"> · {store.neighborhood} · {store.rating.toFixed(1)} ★</span>
                  ) : null}
                </p>
                <p className="mt-3 text-3xl font-black text-ink">{formatCurrency(product.price)}</p>
                <p className="mt-3 text-sm leading-6 text-ink-muted">Produto com entrega rápida, avaliação excelente e opção de compra segura direto no app.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {off !== null && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
                      {off}% OFF
                    </span>
                  )}
                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">{product.arrival}</span>
                  {product.express && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                      Entrega turbo
                    </span>
                  )}
                </div>
                <ProductReviews productId={product.id} />
                <div className="mt-5 flex gap-3">
                  <button onClick={() => { onAddToCart(product); onClose() }} className="btn-primary min-h-[44px] px-4 py-2">Adicionar ao carrinho</button>
                  <button onClick={() => onClose()} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-muted">Fechar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
  )
}
