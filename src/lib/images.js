/**
 * Fontes de imagem para dados de demonstração.
 *
 * Decisão registrada em docs/adr/0001-banco-de-imagens.md.
 *
 * - Produtos e lojas: Lorem Picsum (`picsum.photos`). Sem chave de API, URL
 *   determinística por seed, acervo vindo do Unsplash (Unsplash License:
 *   uso comercial livre, sem atribuição obrigatória).
 * - Clientes: DiceBear, estilo `avataaars` (uso pessoal e comercial livre,
 *   sem atribuição). Avatar ilustrado em vez de foto de pessoa real — dado
 *   falso não deve carregar rosto de alguém de verdade.
 *
 * Toda imagem remota tem fallback local em SVG (`localImage`), aplicado via
 * `onError` nos componentes. Se o serviço cair ou o dispositivo estiver
 * offline, a interface degrada para o placeholder embutido em vez de quebrar.
 */

const PICSUM = 'https://picsum.photos/seed'
const DICEBEAR = 'https://api.dicebear.com/9.x/avataaars/svg'

/** Slug estável: a mesma entidade sempre recebe a mesma foto. */
const toSeed = (value) =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Placeholder local em data URI — sem rede, funciona offline e em teste. */
export const localImage = (label, bg = '#E8E8E8', fg = '#5C6670') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="presentation">
    <rect width="400" height="400" fill="${bg}"/>
    <circle cx="200" cy="168" r="76" fill="${fg}" opacity="0.14"/>
    <text x="200" y="188" font-family="Rubik, system-ui, sans-serif" font-size="88"
          font-weight="700" fill="${fg}" text-anchor="middle">${label.slice(0, 2).toUpperCase()}</text>
    <text x="200" y="300" font-family="Nunito Sans, system-ui, sans-serif" font-size="26"
          font-weight="600" fill="${fg}" opacity="0.65" text-anchor="middle">${label}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, ' '))}`
}

/** Foto quadrada de produto, estável para o mesmo seed. */
export const productImage = (seed, size = 400) => `${PICSUM}/${toSeed(seed)}/${size}/${size}`

/** Foto panorâmica de fachada/vitrine de loja. */
export const storeImage = (seed, width = 640, height = 360) =>
  `${PICSUM}/${toSeed(seed)}-loja/${width}/${height}`

/** Avatar ilustrado do cliente — nunca foto de pessoa real. */
export const avatarImage = (seed) =>
  `${DICEBEAR}?seed=${encodeURIComponent(toSeed(seed))}&backgroundColor=ffd91f,ffe873,e8e8e8`

/**
 * Handler de erro para <img>: troca a fonte remota pelo placeholder local uma
 * única vez. O guard evita laço infinito caso o próprio fallback falhe.
 */
export const fallbackTo = (label, bg, fg) => (event) => {
  const img = event.currentTarget
  if (img.dataset.fallbackApplied) return
  img.dataset.fallbackApplied = 'true'
  img.src = localImage(label, bg, fg)
}
