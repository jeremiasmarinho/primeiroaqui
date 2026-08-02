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
    <div className="rounded-[20px] border border-line bg-surface p-3">
      <label htmlFor="cupom" className="text-sm font-semibold text-ink">
        Cupom de desconto
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="cupom"
          value={couponCode}
          onChange={(event) => onCouponCodeChange(event.target.value.toUpperCase())}
          placeholder="Digite o código"
          autoComplete="off"
          className="field-input h-11 flex-1 rounded-[14px] uppercase"
        />
        {discount > 0 ? (
          <button
            type="button"
            onClick={onRemoveCoupon}
            className="min-h-[44px] rounded-[14px] border border-line px-4 text-sm font-bold text-ink-muted"
          >
            Remover
          </button>
        ) : (
          <button
            type="button"
            onClick={onApplyCoupon}
            className="btn-primary min-h-[44px] rounded-[14px] px-4"
          >
            Aplicar
          </button>
        )}
      </div>
      {couponError ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-error">
          {couponError}
        </p>
      ) : null}
    </div>
  )
}
