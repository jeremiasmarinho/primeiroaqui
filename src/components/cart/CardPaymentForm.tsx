import { formatCardExpiry, formatCardNumber } from '../../lib/paymentValidation'
import type { CardFormState, CustomerFormState } from '../../state/usePaymentCheckoutState'
import CustomerFields from './CustomerFields'
import PaymentTextField from './PaymentTextField'

interface CardPaymentFormProps {
  cardForm: CardFormState
  customerForm: CustomerFormState
  fieldErrors: Record<string, string>
  disabled: boolean
  onCardFormChange: (patch: Partial<CardFormState>) => void
  onCustomerFormChange: (patch: Partial<CustomerFormState>) => void
}

/** Campos de cartão (número/nome/validade/CVV) + CPF/telefone (CustomerFields, compartilhado com o Pix puro). */
export default function CardPaymentForm({
  cardForm,
  customerForm,
  fieldErrors,
  disabled,
  onCardFormChange,
  onCustomerFormChange,
}: CardPaymentFormProps) {
  return (
    <div className="space-y-3">
      <PaymentTextField
        id="card-number"
        label="Número do cartão"
        value={cardForm.number}
        placeholder="0000 0000 0000 0000"
        autoComplete="cc-number"
        disabled={disabled}
        error={fieldErrors.number}
        onChange={(value) => onCardFormChange({ number: formatCardNumber(value) })}
      />
      <PaymentTextField
        id="card-holder"
        label="Nome impresso no cartão"
        value={cardForm.holderName}
        inputMode={undefined}
        autoComplete="cc-name"
        disabled={disabled}
        error={fieldErrors.holderName}
        onChange={(value) => onCardFormChange({ holderName: value.toUpperCase() })}
      />

      <div className="grid grid-cols-2 gap-3">
        <PaymentTextField
          id="card-expiry"
          label="Validade"
          value={cardForm.expiry}
          placeholder="MM/AA"
          autoComplete="cc-exp"
          disabled={disabled}
          error={fieldErrors.expiry}
          onChange={(value) => onCardFormChange({ expiry: formatCardExpiry(value) })}
        />
        <PaymentTextField
          id="card-cvv"
          label="CVV"
          value={cardForm.cvv}
          placeholder="000"
          autoComplete="cc-csc"
          disabled={disabled}
          error={fieldErrors.cvv}
          onChange={(value) => onCardFormChange({ cvv: value.replace(/\D/g, '').slice(0, 4) })}
        />
      </div>

      <CustomerFields
        customerForm={customerForm}
        fieldErrors={fieldErrors}
        disabled={disabled}
        onCustomerFormChange={onCustomerFormChange}
      />
    </div>
  )
}
