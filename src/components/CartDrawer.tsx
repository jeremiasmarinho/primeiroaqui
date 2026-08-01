import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react'
import { formatCurrency } from '../lib/format'
import { getCartItemsCount, getCartSubtotal, getLineSubtotal, MAX_QUANTITY_PER_ITEM } from '../state/cart'
import type { CartState, DeliveryForm, PaymentMethod } from '../types'

export type CheckoutStep = 'cart' | 'delivery'

const PAYMENT_METHODS: PaymentMethod[] = ['Pix', 'Cartão', 'Boleto']

interface CartDrawerProps {
  open: boolean
  step: CheckoutStep
  cartState: CartState
  deliveryForm: DeliveryForm
  checkoutError: string
  couponCode: string
  couponError: string
  discount: number
  onClose: () => void
  onIncrement: (productId: number) => void
  onDecrement: (productId: number) => void
  onRemove: (productId: number) => void
  onDeliveryChange: (patch: Partial<DeliveryForm>) => void
  onCouponCodeChange: (code: string) => void
  onApplyCoupon: () => void
  onRemoveCoupon: () => void
  onContinue: () => void
  onConfirm: () => void
}

/**
 * Gaveta de carrinho e checkout em dois passos.
 *
 * Todos os controles de quantidade têm 44px de alvo e `aria-label` descritivo:
 * um `+` sozinho não diz ao leitor de tela de que produto se trata.
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
}: CartDrawerProps) {
  if (!open) return null

  const itemsCount = getCartItemsCount(cartState)
  const subtotal = getCartSubtotal(cartState)
  const total = Math.max(0, subtotal - discount)

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={step === 'cart' ? 'Carrinho de compras' : 'Dados de entrega'}
        className="ml-auto flex h-full max-w-md flex-col overflow-hidden rounded-[32px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]"
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-gradient-to-r from-slate-950 to-slate-800 p-4 text-white">
          <div>
            <h2 className="font-display text-lg font-black">
              {step === 'cart' ? 'Carrinho' : 'Entrega'}
            </h2>
            <p className="text-sm text-slate-300">
              {step === 'cart' ? `${itemsCount} itens` : 'Complete os dados para o pedido'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar carrinho"
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {step === 'cart' ? (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-white to-slate-50 p-4">
              {itemsCount === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center">
                  <ShoppingCart className="mx-auto h-9 w-9 text-slate-300" aria-hidden="true" />
                  <p className="mt-3 font-bold text-slate-900">Seu carrinho está vazio</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Adicione produtos da vitrine para continuar.
                  </p>
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
                  <div
                    key={item.product.id}
                    className="rounded-[20px] border border-slate-200/80 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display font-bold leading-snug text-slate-950">
                          {item.product.title}
                        </p>
                        <p className="text-sm text-slate-500">
                          {formatCurrency(item.product.price)} cada
                        </p>
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
                      <span className="tabular font-black text-slate-900">
                        {formatCurrency(getLineSubtotal(item))}
                      </span>
                    </div>
                  </div>
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
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-white to-slate-50 p-4">
            <div className="rounded-[24px] bg-slate-950 p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Resumo do pedido
              </p>
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

            <div className="rounded-[20px] border border-slate-200 bg-white p-3">
              <label htmlFor="cupom" className="text-sm font-semibold text-slate-700">
                Cupom de desconto
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="cupom"
                  value={couponCode}
                  onChange={(event) => onCouponCodeChange(event.target.value.toUpperCase())}
                  placeholder="Digite o código"
                  autoComplete="off"
                  className="h-11 flex-1 rounded-[14px] border border-slate-200 px-3 uppercase outline-none focus:border-slate-900"
                />
                {discount > 0 ? (
                  <button
                    type="button"
                    onClick={onRemoveCoupon}
                    className="min-h-[44px] rounded-[14px] border border-slate-200 px-4 text-sm font-bold text-slate-700"
                  >
                    Remover
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onApplyCoupon}
                    className="min-h-[44px] rounded-[14px] bg-slate-900 px-4 text-sm font-bold text-white"
                  >
                    Aplicar
                  </button>
                )}
              </div>
              {couponError ? (
                <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
                  {couponError}
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              {(
                [
                  { id: 'nome', label: 'Seu nome', key: 'name', autoComplete: 'name' },
                  { id: 'endereco', label: 'Endereço', key: 'address', autoComplete: 'street-address' },
                ] as const
              ).map((field) => (
                <div key={field.id}>
                  <label htmlFor={field.id} className="text-sm font-semibold text-slate-700">
                    {field.label}
                  </label>
                  <input
                    id={field.id}
                    value={deliveryForm[field.key]}
                    onChange={(event) => onDeliveryChange({ [field.key]: event.target.value })}
                    autoComplete={field.autoComplete}
                    className="mt-1 h-12 w-full rounded-[16px] border border-slate-200 bg-white px-3 outline-none focus:border-slate-900"
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cidade" className="text-sm font-semibold text-slate-700">
                    Cidade
                  </label>
                  <input
                    id="cidade"
                    value={deliveryForm.city}
                    onChange={(event) => onDeliveryChange({ city: event.target.value })}
                    autoComplete="address-level2"
                    className="mt-1 h-12 w-full rounded-[16px] border border-slate-200 bg-white px-3 outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="cep" className="text-sm font-semibold text-slate-700">
                    CEP
                  </label>
                  <input
                    id="cep"
                    value={deliveryForm.cep}
                    onChange={(event) => onDeliveryChange({ cep: event.target.value })}
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="00000-000"
                    className="mt-1 h-12 w-full rounded-[16px] border border-slate-200 bg-white px-3 outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <fieldset>
                <legend className="text-sm font-semibold text-slate-700">Forma de pagamento</legend>
                <div className="mt-2 grid gap-2">
                  {PAYMENT_METHODS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={deliveryForm.payment === option}
                      onClick={() => onDeliveryChange({ payment: option })}
                      className={`min-h-[48px] rounded-[16px] border px-3 text-left text-sm font-semibold transition-colors duration-150 ${
                        deliveryForm.payment === option
                          ? 'border-slate-950 bg-slate-950 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            {checkoutError ? (
              <p
                role="alert"
                className="rounded-[16px] bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
              >
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
        )}
      </div>
    </div>
  )
}
