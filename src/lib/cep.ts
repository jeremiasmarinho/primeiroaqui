/**
 * Busca de endereço por CEP via ViaCEP (https://viacep.com.br).
 *
 * Prior-art (2026-08-06): ViaCEP é a API pública consolidada para CEP no
 * Brasil — gratuita, sem chave, com CORS liberado e sem dependência npm
 * (fetch puro), então não cria lock-in nem risco de supply chain. A
 * alternativa (BrasilAPI) é equivalente; ViaCEP foi escolhida por ser a mais
 * estabelecida. Trocar de provedor é alterar apenas este arquivo.
 */

export interface CepAddress {
  /** Logradouro ("Avenida Paulista"). Pode vir vazio em CEPs de cidade única. */
  street: string
  city: string
  /** UF, ex.: "SP". */
  state: string
}

interface ViaCepResponse {
  logradouro?: string
  localidade?: string
  uf?: string
  erro?: boolean
}

/** true quando o valor tem exatamente 8 dígitos (com ou sem máscara). */
export const isCompleteCep = (value: string): boolean => value.replace(/\D/g, '').length === 8

/**
 * Consulta o CEP e devolve o endereço, ou `null` para CEP inexistente,
 * incompleto ou falha de rede — a busca é conveniência de preenchimento,
 * nunca pode bloquear o formulário, então erro degrada para "sem sugestão".
 */
export async function lookupCep(cep: string, fetchImpl: typeof fetch = fetch): Promise<CepAddress | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null

  try {
    const response = await fetchImpl(`https://viacep.com.br/ws/${digits}/json/`)
    if (!response.ok) return null
    const data = (await response.json()) as ViaCepResponse
    if (data.erro) return null
    return {
      street: data.logradouro ?? '',
      city: data.localidade ?? '',
      state: data.uf ?? '',
    }
  } catch {
    return null
  }
}
