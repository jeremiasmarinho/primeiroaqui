/**
 * Normaliza um termo de busca para comparacao tolerante a acento e
 * pontuacao: NFD (separa a letra do diacritico) + remocao dos diacriticos
 * (regex ̀-ͯ) + remocao de qualquer caractere nao alfanumerico
 * (mantendo espacos, para nao colar palavras) + lowercase. Aplicar dos DOIS
 * lados da comparacao (termo digitado e texto pesquisado) e o que faz
 * "maca!", "MACA" e "maca" (com cedilha/til) todos encontrarem "Maca Gala".
 */
export function normalizeSearchTerm(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toLowerCase()
}
