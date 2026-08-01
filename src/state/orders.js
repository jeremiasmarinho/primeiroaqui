export const ORDER_STATUS = {
  PROCESSING: 'Processando',
  IN_ROUTE: 'Em rota',
  DELIVERED: 'Entregue',
}

const statusTransitions = {
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.IN_ROUTE],
  [ORDER_STATUS.IN_ROUTE]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
}

const parseOrderNumber = (orderId) => {
  const numeric = Number.parseInt(String(orderId).replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(numeric) ? numeric : 1000
}

export const createOrderIdGenerator = (existingOrders) => {
  let current = existingOrders.reduce((max, order) => {
    const number = parseOrderNumber(order.id)
    return number > max ? number : max
  }, 1000)

  return () => {
    current += 1
    return String(current)
  }
}

export const createOrder = ({ cartState, delivery, agentName, role, idGenerator }) => {
  const subtotal = cartState.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  return {
    id: idGenerator(),
    customer: delivery.name || (role === 'admin' ? 'Operador' : 'Cliente'),
    agent: agentName || 'Agente',
    value: subtotal,
    items: cartState.items.map((item) => item.product.title),
    payment: delivery.payment || 'Pix',
    status: ORDER_STATUS.PROCESSING,
    region: delivery.city || 'Centro',
  }
}

export const changeOrderStatus = (order, nextStatus) => {
  const allowed = statusTransitions[order.status] || []

  if (!allowed.includes(nextStatus)) {
    throw new Error(`Transicao invalida: ${order.status} -> ${nextStatus}`)
  }

  return {
    ...order,
    status: nextStatus,
  }
}
