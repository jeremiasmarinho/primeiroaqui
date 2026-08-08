/** Chip de status do pagamento — tokens semânticos (success/warning/error), some quando 'NONE'/ausente. Compartilhado por OrdersScreen e OrderDetailScreen. */
export function PaymentStatusChip({ paymentStatus }: { paymentStatus?: string }) {
  if (!paymentStatus || paymentStatus === 'NONE') return null

  const entry = PAYMENT_STATUS_CONFIG[paymentStatus]
  if (!entry) return null

  return (
    <span className={`rounded-full px-2 py-0.5 text-micro font-bold uppercase tracking-wide ${entry.className}`}>
      {entry.label}
    </span>
  )
}

export const PAYMENT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Aguardando pagamento', className: 'bg-warning/15 text-warning' },
  PAID: { label: 'Pago', className: 'bg-success/15 text-success' },
  FAILED: { label: 'Pagamento falhou', className: 'bg-error/15 text-error' },
  REFUNDED: { label: 'Reembolsado', className: 'bg-surface-sunken text-ink-muted' },
  CHARGEDBACK: { label: 'Contestado', className: 'bg-error/15 text-error' },
}

/** Rótulo pt-BR isolado, para quando a tela precisa do texto sem o chip (ex.: linha de resumo). */
export const paymentStatusLabel = (paymentStatus?: string): string =>
  paymentStatus && paymentStatus !== 'NONE'
    ? (PAYMENT_STATUS_CONFIG[paymentStatus]?.label ?? paymentStatus)
    : 'Sem pagamento registrado'
