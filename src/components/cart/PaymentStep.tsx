import { formatCurrency } from '../../lib/format'
import type { ApiOrder, ApiPaymentStatus } from '../../lib/api'
import type { CardFormState, CustomerFormState, PaymentStatus, PixData } from '../../state/usePaymentCheckoutState'
import type { PaymentMethod } from '../../types'
import CardPaymentForm from './CardPaymentForm'
import CustomerFields from './CustomerFields'
import PixPayment from './PixPayment'

interface PaymentStepProps {
  order?: ApiOrder
  paymentIndex: number
  totalPayments: number
  paymentMethod: PaymentMethod
  cardForm: CardFormState
  customerForm: CustomerFormState
  fieldErrors: Record<string, string>
  status: PaymentStatus
  errorMessage: string
  pixData: PixData | null
  pixPaymentStatus?: ApiPaymentStatus | null
  publicKey: string | null
  configError: string
  onCardFormChange: (patch: Partial<CardFormState>) => void
  onCustomerFormChange: (patch: Partial<CustomerFormState>) => void
  onSubmit: () => void
  onContinue: () => void
  onClose: () => void
}

const STATUS_LABEL: Record<PaymentStatus, string> = {
  idle: 'Pagar',
  tokenizing: 'Validando cartão…',
  paying: 'Processando pagamento…',
  success: 'Pago',
  error: 'Tentar novamente',
}

/** Banner de erro compartilhado (configError + errorMessage usam o mesmo estilo). */
const ErrorBanner = ({ message }: { message: string }) =>
  message ? (
    <p role="alert" className="rounded-[16px] bg-error/10 px-3 py-2 text-sm font-semibold text-error">
      {message}
    </p>
  ) : null

/** Etapa "pagamento" do CartDrawer: cartão (tokenizado no navegador) ou Pix. */
export default function PaymentStep({
  order,
  paymentIndex,
  totalPayments,
  paymentMethod,
  cardForm,
  customerForm,
  fieldErrors,
  status,
  errorMessage,
  pixData,
  pixPaymentStatus,
  publicKey,
  configError,
  onCardFormChange,
  onCustomerFormChange,
  onSubmit,
  onContinue,
  onClose,
}: PaymentStepProps) {
  const isCard = paymentMethod === 'Cartão'
  const isBusy = status === 'tokenizing' || status === 'paying'
  const isLastPayment = paymentIndex + 1 >= totalPayments

  return (
    <div className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-surface to-surface-page p-4">
      {totalPayments > 1 ? (
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
          Pagamento {paymentIndex + 1} de {totalPayments}
        </p>
      ) : null}

      {order ? (
        <div className="rounded-[24px] border border-line bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">Pedido {order.id}</p>
          <p className="tabular mt-1 font-display text-lg font-black text-ink">{formatCurrency(order.totalCents / 100)}</p>
        </div>
      ) : null}

      <ErrorBanner message={configError} />

      {status === 'success' ? (
        <div className="space-y-4">
          {isCard ? (
            <p role="status" className="rounded-[16px] bg-success/10 px-3 py-2 text-sm font-semibold text-success">
              Pagamento aprovado! Pedido {order?.id} confirmado.
            </p>
          ) : (
            pixData && <PixPayment pixData={pixData} paymentStatus={pixPaymentStatus} />
          )}
          <button
            type="button"
            onClick={onContinue}
            className="btn-primary min-h-[48px] w-full rounded-[20px] motion-safe:active:scale-[0.98]"
          >
            {isLastPayment ? 'Ver meus pedidos' : 'Pagar próximo pedido'}
          </button>
        </div>
      ) : (
        <>
          {isCard ? (
            <CardPaymentForm
              cardForm={cardForm}
              customerForm={customerForm}
              fieldErrors={fieldErrors}
              disabled={isBusy || !publicKey}
              onCardFormChange={onCardFormChange}
              onCustomerFormChange={onCustomerFormChange}
            />
          ) : (
            <>
              <p className="text-sm text-ink-muted">
                Ao confirmar, geramos um QR code Pix para o pagamento deste pedido.
              </p>
              {/* Pix puro TAMBÉM exige document/phone no POST /pay (antifraude do
                  Pagar.me) — confirmado em sandbox real: sem esses dados, o
                  pagamento recusa com 400. Mesmos campos/validação/persistência
                  do fluxo cartão (CustomerFields), coletados ANTES do QR. */}
              <CustomerFields
                customerForm={customerForm}
                fieldErrors={fieldErrors}
                disabled={isBusy}
                onCustomerFormChange={onCustomerFormChange}
              />
            </>
          )}

          <ErrorBanner message={errorMessage} />

          <button
            type="button"
            onClick={onSubmit}
            disabled={isBusy || (isCard && !publicKey)}
            aria-busy={isBusy}
            className="btn-primary min-h-[48px] w-full rounded-[20px] motion-safe:active:scale-[0.98]
                       disabled:cursor-not-allowed disabled:opacity-70"
          >
            {STATUS_LABEL[status]}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="min-h-[44px] w-full rounded-[16px] border border-line text-sm font-bold text-ink-muted
                       transition-colors duration-150 hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancelar
          </button>
        </>
      )}
    </div>
  )
}
