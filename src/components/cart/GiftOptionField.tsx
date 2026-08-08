import { Gift } from 'lucide-react'

import type { DeliveryForm } from '../../types'

interface GiftOptionFieldProps {
  /** Se a loja do carrinho embala para presente — controla se a opção pode ser marcada. */
  storeGiftWrapAvailable: boolean
  deliveryForm: DeliveryForm
  onDeliveryChange: (patch: Partial<DeliveryForm>) => void
}

/**
 * Toggle "É um presente?" do checkout (Item 8).
 *
 * Só pode ser marcado quando a loja do carrinho oferece embalagem para
 * presente (`storeGiftWrapAvailable`, derivado de `Store.giftWrapAvailable` —
 * ver Item 9). Quando a loja não oferece, mostra o aviso e mantém a opção
 * desabilitada — nunca deixa marcar. Marcado, exige o nome de quem vai
 * receber (o endereço selecionado/cadastrado no seletor já existente é o do
 * presenteado) e aceita uma mensagem opcional para o cartão.
 */
export default function GiftOptionField({
  storeGiftWrapAvailable,
  deliveryForm,
  onDeliveryChange,
}: GiftOptionFieldProps) {
  if (!storeGiftWrapAvailable) {
    return (
      <div className="rounded-[16px] border border-dashed border-line p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
          <Gift className="h-4 w-4 shrink-0" aria-hidden="true" />
          Esta loja não oferece embalagem para presente
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[16px] border border-line p-3">
      <label htmlFor="e-presente" className="flex min-h-[44px] cursor-pointer items-center gap-3">
        <input
          id="e-presente"
          type="checkbox"
          checked={deliveryForm.isGift}
          onChange={(event) =>
            onDeliveryChange({
              isGift: event.target.checked,
              ...(event.target.checked ? {} : { giftRecipientName: '', giftMessage: '' }),
            })
          }
          className="h-5 w-5 shrink-0 accent-primary"
        />
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Gift className="h-4 w-4 shrink-0" aria-hidden="true" />É um presente?
        </span>
      </label>

      {deliveryForm.isGift ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-ink-muted">
            O endereço selecionado/cadastrado acima é o de quem vai receber o presente.
          </p>
          <div>
            <label htmlFor="presente-nome" className="text-sm font-semibold text-ink">
              Nome de quem vai receber
            </label>
            <input
              id="presente-nome"
              value={deliveryForm.giftRecipientName}
              onChange={(event) => onDeliveryChange({ giftRecipientName: event.target.value })}
              className="field-input mt-1"
            />
          </div>
          <div>
            <label htmlFor="presente-mensagem" className="text-sm font-semibold text-ink">
              Mensagem do presente (opcional)
            </label>
            <textarea
              id="presente-mensagem"
              value={deliveryForm.giftMessage}
              onChange={(event) => onDeliveryChange({ giftMessage: event.target.value })}
              rows={3}
              className="field-input mt-1"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
