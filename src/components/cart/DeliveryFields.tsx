import { formatCep } from '../../state/addresses'
import type { DeliveryForm, PaymentMethod } from '../../types'

const PAYMENT_METHODS: PaymentMethod[] = ['Pix', 'Cartão', 'Boleto']

interface DeliveryFieldsProps {
  deliveryForm: DeliveryForm
  onDeliveryChange: (patch: Partial<DeliveryForm>) => void
}

/** Campos de nome, endereço, cidade, CEP e forma de pagamento do checkout. */
export default function DeliveryFields({ deliveryForm, onDeliveryChange }: DeliveryFieldsProps) {
  return (
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
            onChange={(event) => onDeliveryChange({ cep: formatCep(event.target.value) })}
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
  )
}
