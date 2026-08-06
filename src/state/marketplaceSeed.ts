import type {
  BusinessProfile,
  CartItem,
  DeliveryForm,
  Notification,
  Product,
  Thread,
  User,
} from '../types'

export const initialNotifications: Notification[] = [
  { id: 1, title: 'Entrega em andamento', message: 'João já saiu da loja com seu pedido.', type: 'info' },
  { id: 2, title: 'Oferta para você', message: 'Frete grátis em produtos da categoria Casa.', type: 'success' },
]

export const initialThreads: Thread[] = [
  {
    id: 1,
    participant: 'João Almeida',
    role: 'Agente',
    status: 'Disponível',
    unread: 2,
    messages: [
      { id: 1, text: 'Pedido 1002 saiu da loja e segue para o ponto de encontro.', from: 'agent', time: '14:32' },
      { id: 2, text: 'Estou confirmando o horário de chegada.', from: 'user', time: '14:35' },
    ],
  },
]

export const EMPTY_DELIVERY: DeliveryForm = { name: '', address: '', city: '', cep: '', payment: 'Pix' }
export const EMPTY_BUSINESS: BusinessProfile = { name: '', category: 'Loja local', address: '', phone: '' }

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Papel vem sempre como `BUYER` ao ler o storage. Marcar `ADMIN` à mão no
 * localStorage não concede painel (regressão B5): o papel real é confirmado
 * pelo GET /api/me na inicialização — é a resposta do servidor que eleva.
 */
export const normalizeStoredUser = (value: unknown): User | null => {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<User>
  if (typeof candidate.email !== 'string') return null

  return {
    name:
      typeof candidate.name === 'string' && candidate.name.trim()
        ? candidate.name
        : 'Cliente Primeiro Aqui',
    email: candidate.email,
    role: 'BUYER',
  }
}

/** Aceita o formato atual `{items}` e migra o formato antigo (array cru). */
export const normalizeCartItems = (stored: unknown): CartItem[] => {
  if (stored && typeof stored === 'object' && Array.isArray((stored as { items?: unknown }).items)) {
    return (stored as { items: CartItem[] }).items
  }
  if (Array.isArray(stored)) {
    return (stored as Product[]).map((product) => ({ product, quantity: 1 }))
  }
  return []
}
