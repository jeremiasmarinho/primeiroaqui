import FieldError from './FieldError'

interface PaymentTextFieldProps {
  id: string
  label: string
  value: string
  placeholder?: string
  /** Default 'numeric' — só o nome no cartão (texto livre) passa `undefined` explicitamente. */
  inputMode?: 'numeric'
  autoComplete?: string
  disabled: boolean
  error?: string
  onChange: (value: string) => void
}

/** Campo texto (label + input + erro inline) compartilhado por CardPaymentForm e CustomerFields. */
export default function PaymentTextField({
  id,
  label,
  value,
  placeholder,
  inputMode = 'numeric',
  autoComplete,
  disabled,
  error,
  onChange,
}: PaymentTextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        className="field-input mt-1"
      />
      <FieldError message={error} />
    </div>
  )
}
