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

/**
 * Entrada de preço digitada ("19,90", "R$ 1.234,56", "25") → centavos
 * inteiros. Aceita vírgula OU ponto como separador decimal (máx. 2 casas) e
 * ignora "R$"/espaços/separador de milhar. Retorna null para entrada inválida
 * ou não positiva — o formulário decide a mensagem.
 */
export const parseBRLToCents = (input: string): number | null => {
  const cleaned = input.replace(/\s|R\$/g, '')
  if (!cleaned) return null
  // Normaliza: remove pontos de milhar quando há vírgula decimal; senão trata
  // um único ponto como decimal.
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const cents = Math.round(Number(normalized) * 100)
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}
