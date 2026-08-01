/**
 * Catálogo mock.
 *
 * As imagens são SVG inline em data URI de propósito: o app não depende de
 * serviço externo de placeholder (corrige B6 do ORQUESTRACAO-AGENTES.md),
 * funciona offline e não gera requisição de rede em teste.
 * Ao ligar o backend (WU-23), trocar `image` pela URL do storage S3-compatível.
 */
const placeholder = (label, bg, fg) => {
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

export const products = [
  {
    id: 1,
    title: 'Ventilador de Mesa Premium 6 Pás Silencioso',
    price: 199.9,
    listPrice: 289.9,
    seller: 'Loja Vizinhança',
    rating: 4.9,
    reviews: 982,
    sold: 1000,
    category: 'Casa',
    freeShipping: true,
    express: true,
    arrival: 'Chega grátis amanhã',
    image: placeholder('Ventilador', '#FFF3D6', '#8A5A00'),
  },
  {
    id: 2,
    title: 'Kit Supermercado Express — 18 itens essenciais',
    price: 129.9,
    listPrice: 159.9,
    seller: 'Mercado Central',
    rating: 4.8,
    reviews: 1240,
    sold: 5000,
    category: 'Supermercado',
    freeShipping: true,
    express: true,
    arrival: 'Chega grátis hoje',
    image: placeholder('Mercado', '#DCEBFF', '#123A78'),
  },
  {
    id: 3,
    title: 'Smartwatch Fitness GPS à Prova d’Água',
    price: 379.9,
    listPrice: 549.0,
    seller: 'Tech Shop',
    rating: 4.7,
    reviews: 860,
    sold: 500,
    category: 'Eletrônico',
    freeShipping: true,
    express: false,
    arrival: 'Chega grátis quinta-feira',
    image: placeholder('Smartwatch', '#DFF3FB', '#0B4A63'),
  },
  {
    id: 4,
    title: 'Box de Cuidados Pessoais com 12 Produtos',
    price: 84.9,
    listPrice: 106.0,
    seller: 'Farmácia Local',
    rating: 4.8,
    reviews: 1120,
    sold: 2000,
    category: 'Farmácia',
    freeShipping: false,
    express: true,
    arrival: 'Retirada em 30 min',
    image: placeholder('Cuidados', '#EDE7FF', '#4A2A9C'),
  },
  {
    id: 5,
    title: 'Barraca de Camping 4 Pessoas Impermeável',
    price: 199.9,
    listPrice: 249.9,
    seller: 'Aventura Store',
    rating: 4.6,
    reviews: 430,
    sold: 5000,
    category: 'Casa',
    freeShipping: true,
    express: true,
    arrival: 'Chega grátis quinta-feira',
    image: placeholder('Barraca', '#DDEBF7', '#12395E'),
  },
  {
    id: 6,
    title: 'Conjunto de Jantar Mesa 6 Cadeiras Madeira',
    price: 2629.0,
    listPrice: 4103.0,
    seller: 'Mobília e Decor',
    rating: 4.5,
    reviews: 210,
    sold: 100,
    category: 'Casa',
    freeShipping: true,
    express: false,
    arrival: 'Chega grátis em 5 dias',
    image: placeholder('Jantar', '#F0E6DA', '#6A4A28'),
  },
  {
    id: 7,
    title: 'Whey Concentrado 900g Sabor Baunilha',
    price: 137.69,
    listPrice: 161.0,
    seller: 'Suplementos Bairro',
    rating: 4.7,
    reviews: 3400,
    sold: 10000,
    category: 'Farmácia',
    freeShipping: false,
    express: true,
    arrival: 'Chega hoje',
    image: placeholder('Whey', '#E6F6E9', '#0B5B2A'),
  },
  {
    id: 8,
    title: 'Painel para TV até 65" com Nicho e LED',
    price: 527.0,
    listPrice: 731.9,
    seller: 'Mobília e Decor',
    rating: 4.4,
    reviews: 156,
    sold: 500,
    category: 'Casa',
    freeShipping: true,
    express: false,
    arrival: 'Chega grátis sexta-feira',
    image: placeholder('Painel', '#E8E4DE', '#3B342C'),
  },
]

export const categories = ['Tudo', 'Supermercado', 'Farmácia', 'Casa', 'Eletrônico']

export const banners = [
  {
    id: 'b1',
    eyebrow: 'Semana do bairro',
    title: 'Cupons relâmpago',
    subtitle: 'Novos cupons liberados às 09h, 12h e 15h',
    cta: 'Resgatar cupom',
    tone: 'brand',
  },
  {
    id: 'b2',
    eyebrow: 'Primeiro Aqui+',
    title: 'Frete grátis o mês inteiro',
    subtitle: 'Assine e receba sem custo em todo o bairro',
    cta: 'Conhecer o plano',
    tone: 'ink',
  },
  {
    id: 'b3',
    eyebrow: 'Entrega turbo',
    title: 'Seu pedido em até 2 horas',
    subtitle: 'Agentes locais saindo da loja mais perto de você',
    cta: 'Ver lojas próximas',
    tone: 'ship',
  },
]

export const shortcuts = [
  { id: 's1', label: 'Ofertaço', icon: 'percent', tag: 'NOVO' },
  { id: 's2', label: 'Cupons', icon: 'ticket' },
  { id: 's3', label: 'Pontos', icon: 'award', tag: 'GANHE' },
  { id: 's4', label: 'Indique', icon: 'users', tag: 'GANHE $' },
  { id: 's5', label: 'Lojas locais', icon: 'store' },
  { id: 's6', label: 'Mercado', icon: 'cart' },
]

/** Percentual de desconto arredondado; null quando não há preço de lista válido. */
export const discountPercent = (product) => {
  if (!product?.listPrice || !product?.price) return null
  if (product.listPrice <= product.price) return null
  return Math.round((1 - product.price / product.listPrice) * 100)
}

/** "+1000 vendidos" / "+5mil vendidos" — abreviação usada nos cards. */
export const soldLabel = (sold) => {
  if (!sold) return null
  if (sold >= 1000) return `+${sold / 1000 >= 10 ? `${sold / 1000}mil` : `${sold}`} vendidos`
  return `+${sold} vendidos`
}
