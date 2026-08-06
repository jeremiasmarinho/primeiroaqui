import {
  changeOrderStatus,
  createOrder,
  createOrderIdGenerator,
  ORDER_STATUS,
  repeatOrder,
} from './orders'
import { makeCartItem, makeCartState, makeDelivery, makeOrder, makeProduct } from '../test/factories'
import type { Product } from '../types'

const cartState = makeCartState([
  makeCartItem({ product: makeProduct({ id: '1', title: 'Produto A', price: 10 }), quantity: 2 }),
  makeCartItem({ product: makeProduct({ id: '2', title: 'Produto B', price: 5 }), quantity: 1 }),
])

describe('orders state', () => {
  it('cria pedido com id unico apos lacunas de pedidos deletados (regressao B1)', () => {
    const existingOrders = [{ id: '1001' }, { id: '1003' }]
    const nextId = createOrderIdGenerator(existingOrders)()
    expect(nextId).toBe('1004')
  })

  it('gera 100 ids distintos', () => {
    const existingOrders: { id: string }[] = []
    const generateId = createOrderIdGenerator(existingOrders)
    const ids = new Set()

    for (let index = 0; index < 100; index += 1) {
      ids.add(generateId())
    }

    expect(ids.size).toBe(100)
  })

  it('gera id sequencial mesmo com id invalido no histórico', () => {
    const existingOrders = [{ id: 'abc' }, { id: 'prefix-1009' }]
    const generateId = createOrderIdGenerator(existingOrders)
    expect(generateId()).toBe('1010')
  })

  it('cria pedido com total baseado no carrinho', () => {
    const generateId = () => '1009'
    const order = createOrder({
      cartState,
      delivery: makeDelivery({ name: 'Ana', city: 'Centro', payment: 'Pix' }),
      agentName: 'Joao',
      role: 'BUYER',
      idGenerator: generateId,
    })

    expect(order.id).toBe('1009')
    expect(order.value).toBe(25)
    expect(order.items).toEqual(['Produto A', 'Produto B'])
  })

  it('usa fallbacks quando delivery vier incompleto', () => {
    const order = createOrder({
      cartState,
      delivery: makeDelivery({ name: '', city: '', payment: 'Pix' }),
      agentName: '',
      role: 'ADMIN',
      idGenerator: () => '1011',
    })

    expect(order.customer).toBe('Operador')
    expect(order.agent).toBe('Agente')
    expect(order.payment).toBe('Pix')
    expect(order.region).toBe('Centro')
  })

  it('permite transicao valida Processando -> Em rota -> Entregue', () => {
    const base = makeOrder({ status: ORDER_STATUS.PROCESSING })
    const inRoute = changeOrderStatus(base, ORDER_STATUS.IN_ROUTE)
    const delivered = changeOrderStatus(inRoute, ORDER_STATUS.DELIVERED)

    expect(inRoute.status).toBe(ORDER_STATUS.IN_ROUTE)
    expect(delivered.status).toBe(ORDER_STATUS.DELIVERED)
  })

  it('rejeita transicao invalida Entregue -> Processando', () => {
    const delivered = makeOrder({ status: ORDER_STATUS.DELIVERED })
    expect(() => changeOrderStatus(delivered, ORDER_STATUS.PROCESSING)).toThrow()
  })

  it('rejeita transicao com status desconhecido', () => {
    const unknown = makeOrder({ status: 'Desconhecido' as never })
    expect(() => changeOrderStatus(unknown, ORDER_STATUS.DELIVERED)).toThrow()
  })
})

/**
 * WU-48 — repetir pedido.
 *
 * `items` guarda só títulos, que servem para exibir mas não para recomprar.
 * `lines` guarda `{productId, quantity}`: o preço é sempre relido do catálogo,
 * nunca do histórico, senão repetir um pedido antigo congelaria um preço velho.
 */
describe('repetir pedido', () => {
  const catalog = [
    makeProduct({ id: '1', title: 'Produto A', price: 10 }),
    makeProduct({ id: '2', title: 'Produto B', price: 5 }),
  ]

  it('o pedido criado guarda as linhas com quantidade', () => {
    const order = createOrder({
      cartState,
      delivery: makeDelivery(),
      role: 'BUYER',
      idGenerator: () => '1020',
    })

    expect(order.lines).toEqual([
      { productId: '1', quantity: 2 },
      { productId: '2', quantity: 1 },
    ])
  })

  it('o pedido criado guarda o endereco de entrega escolhido', () => {
    const order = createOrder({
      cartState,
      delivery: makeDelivery({ address: 'Avenida Guanabara, 148' }),
      role: 'BUYER',
      idGenerator: () => '1021',
    })

    expect(order.address).toBe('Avenida Guanabara, 148')
  })

  it('recria o carrinho com os mesmos itens e quantidades', () => {
    const order = createOrder({
      cartState,
      delivery: makeDelivery(),
      role: 'BUYER',
      idGenerator: () => '1022',
    })

    const result = repeatOrder(order, catalog)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.items).toHaveLength(2)
    expect(result.items[0]?.quantity).toBe(2)
    expect(result.items[0]?.product.id).toBe('1')
    expect(result.items[1]?.quantity).toBe(1)
  })

  it('usa o preco atual do catalogo, nao o do historico', () => {
    const order = createOrder({
      cartState,
      delivery: makeDelivery(),
      role: 'BUYER',
      idGenerator: () => '1023',
    })

    const result = repeatOrder(order, [makeProduct({ id: '1', price: 99 }), ...catalog.slice(1)])
    if (!result.ok) throw new Error('deveria repetir')
    expect(result.items[0]?.product.price).toBe(99)
  })

  it('pedido sem linhas (historico antigo) explica por que nao da para repetir', () => {
    const result = repeatOrder(makeOrder({ id: '1001' }), catalog)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toMatch(/itens/i)
  })

  it('produto fora do catalogo rejeita com mensagem, sem carrinho pela metade', () => {
    const order = createOrder({
      cartState,
      delivery: makeDelivery(),
      role: 'BUYER',
      idGenerator: () => '1024',
    })

    const result = repeatOrder(order, [catalog[0] as Product])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toMatch(/catálogo/i)
  })
})
