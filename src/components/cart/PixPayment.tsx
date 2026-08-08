import { useEffect, useState } from 'react'
import type { ApiPaymentStatus } from '../../lib/api'
import type { PixData } from '../../state/usePaymentCheckoutState'

interface PixPaymentProps {
  pixData: PixData
  /** Status ao vivo (GET /orders/:id/payment, via polling) — null enquanto a 1ª leitura não chega. */
  paymentStatus?: ApiPaymentStatus | null
}

const formatCountdown = (secondsLeft: number): string => {
  const clamped = Math.max(0, secondsLeft)
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** QR code do Pix com contagem regressiva até `expiresAt`, código copia-e-cola e status ao vivo. */
export default function PixPayment({ pixData, paymentStatus }: PixPaymentProps) {
  const expiresAtMs = pixData.expiresAt ? new Date(pixData.expiresAt).getTime() : null
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!expiresAtMs) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [expiresAtMs])

  const secondsLeft = expiresAtMs ? Math.round((expiresAtMs - now) / 1000) : null
  const expired = secondsLeft !== null && secondsLeft <= 0
  const isPaid = paymentStatus === 'PAID'

  const copyPixCode = async () => {
    if (!pixData.qrCode) return
    try {
      await navigator.clipboard.writeText(pixData.qrCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard bloqueado (permissão/HTTP sem TLS): o código continua visível para copiar à mão.
    }
  }

  return (
    <div className="space-y-3 rounded-[24px] border border-line bg-surface p-4 text-center">
      <p className="font-display text-base font-bold text-ink">Pague com Pix</p>
      {pixData.qrCodeUrl ? (
        <img
          src={pixData.qrCodeUrl}
          alt="QR code do Pix para pagamento"
          className="mx-auto h-48 w-48 rounded-[16px] border border-line"
        />
      ) : null}
      {pixData.qrCode ? (
        <>
          <p className="break-all rounded-[12px] bg-surface-sunken p-2 text-xs text-ink-muted">{pixData.qrCode}</p>
          <button
            type="button"
            onClick={() => void copyPixCode()}
            className="min-h-[40px] rounded-[14px] border border-line px-4 text-sm font-bold text-ink
                       transition-colors duration-150 hover:bg-surface-sunken"
          >
            {copied ? 'Código copiado!' : 'Copiar código Pix'}
          </button>
        </>
      ) : null}
      {secondsLeft !== null && !isPaid ? (
        <p role="timer" className={`text-sm font-bold ${expired ? 'text-error' : 'text-ink-muted'}`}>
          {expired ? 'QR code expirado — gere um novo pagamento.' : `Expira em ${formatCountdown(secondsLeft)}`}
        </p>
      ) : null}
      <p role="status" className={`text-sm font-bold ${isPaid ? 'text-success' : 'text-ink-muted'}`}>
        {isPaid
          ? 'Pagamento confirmado!'
          : // Sandbox: nenhum pagador automático confirma o Pix — "aguardando" é o estado esperado num teste manual.
            'Aguardando confirmação do pagamento…'}
      </p>
    </div>
  )
}
