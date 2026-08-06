import type { AuthForm } from '../screens/LoginScreen'
import type { AddressDraft } from '../state/addresses'
import type {
  Address,
  BusinessProfile,
  Category,
  Order,
  Product,
  Role,
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
  authPending: boolean
  onQuickLogin: (role: Role) => void
  onLogout: () => void
  onRequireLogin: (path: string) => void
  loginContextMessage: string
  /** Onboarding de lojista: promove BUYER→STORE_OWNER e abre o cadastro do negócio. */
  onBecomeStoreOwner: () => void

  // vitrine — catálogo real (GET /api/products)
  products: Product[]
  productsLoading: boolean
  productsError: string
  onRetryProducts: () => void
  categories: Category[]
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

  // pedidos reais (GET /api/me/orders)
  orders: Order[]
  ordersLoading: boolean
  ordersError: string
  currentOrder: Order | null
  onRepeatOrder: (order: Order) => void
  repeatError: string
  businessProfile: BusinessProfile | null

  // endereços reais (GET /api/me/addresses)
  addresses: Address[]
  addressesLoading: boolean
  addressesError: string
  addressLine: string
  addressForm: AddressDraft
  addressError: string
  onAddressFormChange: (patch: Partial<AddressDraft>) => void
  onAddressSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}
