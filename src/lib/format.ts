export const formatCurrency = (value: unknown, fallback = 'R$ 0,00'): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
