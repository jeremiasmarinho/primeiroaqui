interface CouponFieldProps {
  couponCode: string
  couponError: string
  discount: number
  onCouponCodeChange: (code: string) => void
  onApplyCoupon: () => void
  onRemoveCoupon: () => void
}

/** Campo de cupom de desconto do passo de entrega. */
export default function CouponField({
  couponCode,
  couponError,
  discount,
  onCouponCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
}: CouponFieldProps) {
  return (
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
  )
}
