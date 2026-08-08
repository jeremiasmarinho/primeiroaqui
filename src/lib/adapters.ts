import { centsToReais } from './money'
import { orderStatusLabel } from './orderStatus'
import { localImage } from './images'
import type { ApiFavoriteProduct, ApiOrder, ApiAddress, ApiProduct, ApiStore } from './api'
import type { Address, Order, Product, Store } from '../types'

/**
 * Adaptadores DTO da API → view-models das telas.
 *
 * As telas foram desenhadas sobre um shape rico de demonstração (rating,
 * vendidos, frete, imagem). O backend real ainda não fornece tudo isso, então
 * o adaptador preenche com defaults neutros — a tela degrada (sem selo, sem
 * estrela) em vez de quebrar. Quando o backend ganhar esses campos, muda só
 * este arquivo.
 */

export const toViewProduct = (dto: ApiProduct, storeName?: string): Product => {
  const price = centsToReais(dto.priceCents)
  return {
    id: dto.id,
    storeId: dto.storeId,
    title: dto.title,
    price,
    // Sem preço "de lista" no backend: igual ao preço ⇒ nenhum selo de
    // desconto aparece (discountPercent devolve null).
    listPrice: price,
    seller: storeName ?? '',
    rating: 0,
    reviews: 0,
    sold: 0,
    category: dto.category,
    freeShipping: false,
    express: false,
    arrival: 'Entrega combinada com a loja',
    // Foto real quando o produto tem uma cadastrada; senão placeholder local
    // (offline-safe) — mesmo padrão de `favoriteToViewProduct`.
    image: dto.photoUrl ?? localImage(dto.title),
    stock: dto.stock,
  }
}

/** Projeção reduzida de GET /me/favorites → card de produto. */
export const favoriteToViewProduct = (dto: ApiFavoriteProduct): Product => {
  const price = centsToReais(dto.priceCents)
  return {
    id: dto.id,
    storeId: dto.storeId,
    title: dto.title,
    price,
    listPrice: price,
    seller: '',
    rating: 0,
    reviews: 0,
    sold: 0,
    category: '',
    freeShipping: false,
    express: false,
    arrival: 'Entrega combinada com a loja',
    image: dto.photoUrl ?? localImage(dto.title),
  }
}

export const toViewStore = (dto: ApiStore): Store => ({
  id: dto.id,
  slug: dto.slug,
  name: dto.name,
  category: '',
  storeCategory: dto.category,
  rating: 0,
  deliveries: 0,
  neighborhood: dto.description ?? '',
  cover: localImage(dto.name),
  logoUrl: dto.logoUrl,
})

/** cep exibido = zipCode do backend; lat/lng ficam no backend, a UI não usa. */
export const toViewAddress = (dto: ApiAddress): Address => ({
  id: dto.id,
  label: dto.label,
  street: dto.street,
  city: dto.city,
  cep: dto.zipCode,
  isDefault: dto.isDefault,
})

/**
 * Pedido da API → linha do histórico. `titleById` resolve nomes de produto a
 * partir do catálogo carregado; item cujo produto saiu do catálogo aparece
 * como "Produto". `storeNameById` resolve o nome da loja a partir do
 * catálogo carregado (sem endpoint novo); loja não encontrada some com
 * graça — `storeName` fica undefined.
 */
export const toViewOrder = (
  dto: ApiOrder,
  titleById: Map<string, string> = new Map(),
  storeNameById: Map<string, string> = new Map(),
): Order => ({
  id: dto.id,
  customer: '',
  agent: '',
  value: centsToReais(dto.totalCents),
  status: orderStatusLabel(dto.status),
  rawStatus: dto.status,
  region: '',
  items: dto.items.map((item) => titleById.get(item.productId) ?? 'Produto'),
  lines: dto.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
  storeId: dto.storeId,
  storeName: storeNameById.get(dto.storeId),
  paymentStatus: dto.paymentStatus ?? 'NONE',
})
