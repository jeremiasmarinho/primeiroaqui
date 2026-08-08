/**
 * Navegação "dura": troca de página real (full page reload) via
 * `window.location`, em vez de roteamento SPA. Usada no pós-login (senha e
 * Google) e no logout para garantir que nenhum estado/cache obsoleto de
 * memória sobrevive à troca de identidade — mesmo padrão do Mercado Livre.
 *
 * A implementação é indireta (variável trocável) porque jsdom não navega de
 * verdade: `window.location.assign` nesse ambiente não desmonta a árvore
 * React nem recarrega módulos, então um teste que dependesse do efeito real
 * travaria sem nunca ver o resultado. `setHardNavigateForTests` é o seam para
 * os testes simularem o reload (ex.: reescrever a URL e re-renderizar o app,
 * ou desmontar/montar de novo para simular perda de memória). Em produção
 * ninguém chama o setter — só o setup de teste.
 */
let impl: (path: string) => void = (path: string) => {
  window.location.assign(path)
}

export const hardNavigate = (path: string): void => {
  impl(path)
}

/** Seam de teste — substitui a implementação real. Nunca usar em produção. */
export const setHardNavigateForTests = (fn: (path: string) => void): void => {
  impl = fn
}
