import { formatCurrency } from './format'

/**
 * Conversão de dinheiro entre o backend e a UI.
 *
 * O backend guarda preço em centavos inteiros (`priceCents`), a UI trabalha
 * com reais. TODA conversão passa por aqui — nenhuma tela divide por 100 por
 * conta própria, senão o dia em que mudarmos a representação sobra tela
 * esquecida cobrando 100x a mais.
 */

/** Centavos inteiros → reais (número). */
export const centsToReais = (cents: number): number => {
  if (!Number.isFinite(cents)) return 0
  return cents / 100
}

/** Centavos inteiros → string BRL ("R$ 19,90"). */
export const formatCents = (cents: number): string => formatCurrency(centsToReais(cents))
