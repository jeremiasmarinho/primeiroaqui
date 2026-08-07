/**
 * Definição das rotas e construtores de URL.
 *
 * Nenhuma tela monta caminho com template string solta. Todo link sai daqui,
 * então renomear uma rota é mudar um arquivo — e o typecheck acusa quem ficou
 * para trás. Também é o ponto que isola o `wouter` (ver ADR 0002): trocar de
 * roteador não toca em nenhuma tela.
 */

export const ROUTE_PATTERNS = {
  home: '/',
  search: '/busca',
  categories: '/categorias',
  category: '/categoria/:slug',
  product: '/produto/:id',
  store: '/loja/:slug',
  order: '/pedido/:id',
  orders: '/pedidos',
  favorites: '/favoritos',
  addresses: '/enderecos',
  profile: '/perfil',
  login: '/entrar',
  resetPassword: '/redefinir-senha',
  admin: '/admin/:tab?',
  myStore: '/minha-loja',
} as const

export const ROUTES = {
  home: '/',
  search: '/busca',
  categories: '/categorias',
  orders: '/pedidos',
  favorites: '/favoritos',
  addresses: '/enderecos',
  profile: '/perfil',
  login: '/entrar',
  resetPassword: '/redefinir-senha',
  myStore: '/minha-loja',
  category: (slug: string) => `/categoria/${slug}`,
  product: (id: number | string) => `/produto/${id}`,
  store: (slug: string) => `/loja/${slug}`,
  order: (id: string) => `/pedido/${id}`,
  admin: (tab: string = 'overview') => `/admin/${tab}`,
  searchFor: (term: string) => `/busca?q=${encodeURIComponent(term)}`,
} as const

/**
 * Rotas protegidas — exigem sessão. Tudo que não está aqui é público
 * (vitrine, produto, loja, categoria, busca, categorias, login).
 *
 * Decisão de produto (2026-08-02, ver docs/superpowers/specs/2026-08-02-
 * vitrine-publica-login-contextual-design.md): navegar, ver produto/loja e
 * adicionar ao carrinho não exige mais conta. Login só aparece ao favoritar,
 * ao avançar para pagamento, ou ao clicar explicitamente em "Entrar".
 *
 * `/favoritos` fica protegido mesmo sendo uma tela de "visualizar": como
 * favoritar sempre exige login, a tela nunca teria conteúdo para visitante.
 */
export const PROTECTED_PATTERNS = [
  '/perfil',
  '/pedidos',
  '/pedido',
  '/enderecos',
  '/favoritos',
  '/admin',
  '/minha-loja',
] as const

export const isProtected = (path: string): boolean =>
  PROTECTED_PATTERNS.some((pattern) => path === pattern || path.startsWith(`${pattern}/`))

/**
 * Slug estável para categoria. A URL usa forma sem acento; a UI mostra o nome
 * com acento. Sem isso, `/categoria/Farmácia` vira `%C3%A1` na barra e some a
 * legibilidade do link compartilhado.
 */
export const toCategorySlug = (category: string): string =>
  category
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
