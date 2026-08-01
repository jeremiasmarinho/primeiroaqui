import {
  changeOrderStatus,
  createOrder,
  createOrderIdGenerator,
  ORDER_STATUS,
} from './orders'
import { makeCartItem, makeCartState, makeDelivery, makeOrder, makeProduct } from '../test/factories'

const cartState = makeCartState([
  makeCartItem({ product: makeProduct({ id: 1, title: 'Produto A', price: 10 }), quantity: 2 }),
  makeCartItem({ product: makeProduct({ id: 2, title: 'Produto B', price: 5 }), quantity: 1 }),
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
      role: 'client',
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
      role: 'admin',
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
