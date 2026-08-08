import { formatCpf, formatPhone } from '../../lib/paymentValidation'
import type { CustomerFormState } from '../../state/usePaymentCheckoutState'
import PaymentTextField from './PaymentTextField'

interface CustomerFieldsProps {
  customerForm: CustomerFormState
  fieldErrors: Record<string, string>
  disabled: boolean
  onCustomerFormChange: (patch: Partial<CustomerFormState>) => void
}

/**
 * CPF + telefone — exigidos pelo POST /orders/:id/pay (document/phone) e
 * pelo antifraude, tanto para CARTÃO quanto para PIX (confirmado no
 * sandbox real: Pix sem esses dados recusa com 400). Reutilizado pelo
 * fluxo Pix puro também — ver `PaymentStep.tsx`.
 */
export default function CustomerFields({
  customerForm,
  fieldErrors,
  disabled,
  onCustomerFormChange,
}: CustomerFieldsProps) {
  return (
    <div className="space-y-3">
      <PaymentTextField
        id="customer-cpf"
        label="CPF"
        value={customerForm.cpf}
        placeholder="000.000.000-00"
        autoComplete="off"
        disabled={disabled}
        error={fieldErrors.cpf}
        onChange={(value) => onCustomerFormChange({ cpf: formatCpf(value) })}
      />
      <PaymentTextField
        id="customer-phone"
        label="Telefone (com DDD)"
        value={customerForm.phone}
        placeholder="(00) 00000-0000"
        autoComplete="tel"
        disabled={disabled}
        error={fieldErrors.phone}
        onChange={(value) => onCustomerFormChange({ phone: formatPhone(value) })}
      />
    </div>
  )
}
