export const formatCurrency = (value, fallback = 'R$\u00a00,00') => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
