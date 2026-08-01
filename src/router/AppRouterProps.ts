import type { AuthForm } from '../screens/LoginScreen'
import type { AgentForm } from '../screens/admin/AgentsTab'
import type { Metric } from '../screens/admin/OverviewTab'
import type { AddressDraft } from '../state/addresses'
import type {
  Address,
  Agent,
  BusinessProfile,
  Order,
  OrderStatus,
  Product,
  Role,
  ScheduleItem,
  User,
} from '../types'

/**
 * Contrato de entrada do roteador.
 *
 * Mora em arquivo próprio para o `AppRouter` ficar só com a tabela de rotas —
 * a lista de props cresce a cada tela e não pode empurrar o roteador para
 * perto do limite de 300 linhas.
 */
export interface AppRouterProps {
  // sessão
  authUser: User | null
  userRole: Role
  isDevMode: boolean

  // login
  authMode: 'login' | 'signup'
  onAuthModeChange: (mode: 'login' | 'signup') => void
  authForm: AuthForm
  onAuthFormChange: (patch: Partial<AuthForm>) => void
  authError: string
  onAuthSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onQuickLogin: (role: Role) => void
  onLogout: () => void

  // vitrine
  searchQuery: string
  onSearchChange: (value: string) => void
  searchRef?: React.RefObject<HTMLInputElement | null>
  favorites: Product[]
  onToggleFavorite: (product: Product) => void
  onAddToCart: (product: Product) => void
  onBuyNow: (product: Product) => void
  cartCount: number
  notificationCount: number
  onOpenCart: () => void

  // pedidos e painel
  orders: Order[]
  currentOrder: Order | null
  onRepeatOrder: (order: Order) => void
  repeatError: string
  agents: Agent[]
  schedule: ScheduleItem[]
  metrics: Metric[]
  agentForm: AgentForm
  onAgentFormChange: (patch: Partial<AgentForm>) => void
  onAgentSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onAgentReset: () => void
  onAgentEdit: (agent: Agent) => void
  onAgentDelete: (agentId: number) => void
  onStatusChange: (orderId: string, status: OrderStatus) => void
  businessProfile: BusinessProfile | null

  // endereços
  addresses: Address[]
  addressLine: string
  addressForm: AddressDraft
  addressError: string
  onAddressFormChange: (patch: Partial<AddressDraft>) => void
  onAddressSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onSetDefaultAddress: (id: string) => void
  onRemoveAddress: (id: string) => void
}
