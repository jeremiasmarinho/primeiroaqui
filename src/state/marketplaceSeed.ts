import type { AgentForm } from '../screens/admin/AgentsTab'
import type {
  Agent,
  BusinessProfile,
  CartItem,
  DeliveryForm,
  Notification,
  Order,
  Product,
  ScheduleItem,
  Thread,
  User,
} from '../types'

export const initialAgents: Agent[] = [
  { id: 1, name: 'João Almeida', region: 'Centro', specialty: 'Entregas urbanas', status: 'Ativo', commission: 12 },
  { id: 2, name: 'Maria Souza', region: 'Zona Norte', specialty: 'Supermercado', status: 'Disponível', commission: 10 },
  { id: 3, name: 'Pedro Lima', region: 'Zona Sul', specialty: 'Farmácia', status: 'Ativo', commission: 13 },
]

export const initialOrders: Order[] = [
  { id: '1001', customer: 'Ana Paula', agent: 'João Almeida', value: 199.9, status: 'Entregue', region: 'Centro' },
  { id: '1002', customer: 'Bruno Costa', agent: 'Maria Souza', value: 129.9, status: 'Em rota', region: 'Zona Norte' },
  { id: '1003', customer: 'Cecília Mendes', agent: 'Pedro Lima', value: 84.9, status: 'Processando', region: 'Zona Sul' },
]

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

export const initialSchedule: ScheduleItem[] = [
  { id: 1, title: 'Recolha no Mercado Central', time: '09:00', agent: 'Maria Souza', status: 'Confirmado' },
  { id: 2, title: 'Entrega no Centro', time: '11:30', agent: 'João Almeida', status: 'Em andamento' },
  { id: 3, title: 'Retirada na Farmácia Local', time: '16:15', agent: 'Pedro Lima', status: 'Pendente' },
]

export const EMPTY_DELIVERY: DeliveryForm = { name: '', address: '', city: '', cep: '', payment: 'Pix' }
export const EMPTY_AGENT_FORM: AgentForm = {
  id: '',
  name: '',
  region: '',
  specialty: '',
  status: 'Disponível',
  commission: '',
}
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
