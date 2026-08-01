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
  admin: '/admin/:tab?',
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
  category: (slug: string) => `/categoria/${slug}`,
  product: (id: number | string) => `/produto/${id}`,
  store: (slug: string) => `/loja/${slug}`,
  order: (id: string) => `/pedido/${id}`,
  admin: (tab: string = 'overview') => `/admin/${tab}`,
  searchFor: (term: string) => `/busca?q=${encodeURIComponent(term)}`,
} as const

/**
 * Rotas públicas. Hoje só o login — todo o resto exige sessão.
 *
 * NOTA DE PRODUTO: o README define que "a vitrine deve ser a página inicial
 * para reduzir atrito de conversão", o que pediria `/`, `/produto/:id` e
 * `/loja/:slug` públicos. Abrir a vitrine é decisão de produto, não de
 * roteamento, então esta WU preserva o comportamento atual. Quando for aberta,
 * basta acrescentar os padrões aqui — o teste `routing.test.tsx` cobre os dois
 * lados da regra.
 */
export const PUBLIC_PATTERNS = ['/entrar'] as const

export const isProtected = (path: string): boolean =>
  !PUBLIC_PATTERNS.some((pattern) => path === pattern || path.startsWith(`${pattern}/`))

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
