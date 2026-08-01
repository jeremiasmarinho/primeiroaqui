import { avatarImage, productImage, storeImage } from '../lib/images.js'

/**
 * Catálogo, lojas e clientes de demonstração.
 *
 * As imagens vêm de serviços gratuitos e determinísticos por seed — ver
 * `src/lib/images.js` e docs/adr/0001-banco-de-imagens.md. Cada <img> tem
 * fallback local, então a UI não quebra offline nem se o serviço cair.
 * Ao ligar o backend (WU-23), trocar por URLs do storage S3-compatível.
 */

export const products = [
  {
    id: 1,
    title: 'Ventilador de Mesa Premium 6 Pás Silencioso',
    bestSeller: true,
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
    image: productImage('Ventilador'),
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
    image: productImage('Mercado'),
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
    image: productImage('Smartwatch'),
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
    image: productImage('Cuidados'),
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
    image: productImage('Barraca'),
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
    image: productImage('Jantar'),
  },
  {
    id: 7,
    title: 'Whey Concentrado 900g Sabor Baunilha',
    bestSeller: true,
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
    image: productImage('Whey'),
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
    image: productImage('Painel'),
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

export const stores = [
  { id: 'st1', name: 'Loja Vizinhança', category: 'Casa', rating: 4.9, deliveries: 1820, neighborhood: 'Centro', cover: storeImage('loja-vizinhanca') },
  { id: 'st2', name: 'Mercado Central', category: 'Supermercado', rating: 4.8, deliveries: 3410, neighborhood: 'Zona Norte', cover: storeImage('mercado-central') },
  { id: 'st3', name: 'Farmácia Local', category: 'Farmácia', rating: 4.8, deliveries: 2260, neighborhood: 'Zona Sul', cover: storeImage('farmacia-local') },
  { id: 'st4', name: 'Tech Shop', category: 'Eletrônico', rating: 4.7, deliveries: 940, neighborhood: 'Centro', cover: storeImage('tech-shop') },
  { id: 'st5', name: 'Mobília e Decor', category: 'Casa', rating: 4.5, deliveries: 610, neighborhood: 'Zona Leste', cover: storeImage('mobilia-e-decor') },
]

export const customers = [
  { id: 'c1', name: 'Ana Paula', neighborhood: 'Centro', orders: 24, avatar: avatarImage('ana-paula') },
  { id: 'c2', name: 'Bruno Costa', neighborhood: 'Zona Norte', orders: 11, avatar: avatarImage('bruno-costa') },
  { id: 'c3', name: 'Cecília Mendes', neighborhood: 'Zona Sul', orders: 38, avatar: avatarImage('cecilia-mendes') },
  { id: 'c4', name: 'Diego Ramos', neighborhood: 'Zona Leste', orders: 7, avatar: avatarImage('diego-ramos') },
]
