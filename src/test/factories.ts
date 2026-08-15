import type {
  Address,
  CartItem,
  CartState,
  DeliveryForm,
  Order,
  Product,
  User,
} from '../types'

/**
 * Factories de teste.
 *
 * Objetivo: o teste declara só o que importa para o caso, e o resto vem de um
 * padrão válido. Fixture incompleta espalhada pelos testes é o que faz a
 * tipagem virar ruído em vez de proteção.
 */

let productSeq = 0

export const makeProduct = (overrides: Partial<Product> = {}): Product => {
  productSeq += 1
  return {
    id: String(productSeq),
    title: `Produto ${productSeq}`,
    price: 100,
    listPrice: 125,
    seller: 'Loja Teste',
    rating: 4.5,
    reviews: 10,
    sold: 100,
    category: 'Casa',
    freeShipping: true,
    express: false,
    arrival: 'Chega amanhã',
    image: 'data:image/svg+xml;utf8,<svg/>',
    ...overrides,
  }
}

export const makeCartItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  product: overrides.product ?? makeProduct(),
  quantity: overrides.quantity ?? 1,
})

export const makeCartState = (items: CartItem[] = []): CartState => ({ items })

export const makeDelivery = (overrides: Partial<DeliveryForm> = {}): DeliveryForm => ({
  name: 'Ana',
  address: 'Rua 1',
  city: 'Centro',
  cep: '12345-678',
  payment: 'Pix',
  isPickup: false,
  isGift: false,
  giftRecipientName: '',
  giftMessage: '',
  ...overrides,
})

export const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: '1001',
  customer: 'Ana',
  agent: 'João',
  value: 100,
  status: 'Processando',
  region: 'Centro',
  ...overrides,
})

export const makeAddress = (overrides: Partial<Address> = {}): Address => ({
  id: 'end-1',
  label: 'Casa',
  street: 'Avenida Guanabara, 148',
  city: 'Centro',
  cep: '12345-678',
  isDefault: false,
  ...overrides,
})

export const makeUser = (overrides: Partial<User> = {}): User => ({
  name: 'Ana',
  email: 'ana@teste.com',
  role: 'BUYER',
  ...overrides,
})

/** Reinicia a sequência de IDs entre suítes, para o teste ficar determinístico. */
export const resetFactories = (): void => {
  productSeq = 0
}
