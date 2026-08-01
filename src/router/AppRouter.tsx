import { Compass } from 'lucide-react'
import { Redirect, Route, Switch, useLocation } from 'wouter'

import EmptyState from '../components/EmptyState'
import CategoriesScreen from '../screens/CategoriesScreen'
import HomeScreen from '../screens/HomeScreen'
import LoginScreen, { type AuthForm } from '../screens/LoginScreen'
import ProductScreen from '../screens/ProductScreen'
import ProfileScreen from '../screens/ProfileScreen'
import StoreScreen from '../screens/StoreScreen'
import TrackingScreen from '../screens/TrackingScreen'
import AdminScreen, { type AdminTab } from '../screens/admin/AdminScreen'
import type { AgentForm } from '../screens/admin/AgentsTab'
import type { Metric } from '../screens/admin/OverviewTab'

import { ROUTE_PATTERNS, ROUTES, isProtected, toCategorySlug } from './routes'
import { categories, products } from '../data/catalog'
import type {
  Agent,
  BusinessProfile,
  Category,
  Order,
  OrderStatus,
  Product,
  Role,
  ScheduleItem,
  User,
} from '../types'

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
}

const categoryFromSlug = (slug: string): Category | null =>
  categories.find((category) => toCategorySlug(category) === slug) ?? null

/**
 * Tabela de rotas do app.
 *
 * Esta é a única camada que conhece o `wouter` (ver ADR 0002). Nenhuma tela
 * importa o roteador para navegar — recebe `href` pronto de `ROUTES` ou um
 * callback do orquestrador.
 */
export default function AppRouter(props: AppRouterProps) {
  const [location, navigate] = useLocation()
  const { authUser, userRole } = props

  // Guarda de sessão: rota protegida sem usuário volta para o login. `replace`
  // evita que o botão voltar caia de novo na rota bloqueada.
  if (!authUser && isProtected(location)) {
    return <Redirect href={ROUTES.login} replace />
  }

  if (authUser && location === ROUTES.login) {
    return <Redirect href={ROUTES.home} replace />
  }

  const vitrine = (category: Category) => (
    <HomeScreen
      products={products.filter((product) => {
        const matchesCategory = category === 'Tudo' || product.category === category
        const query = props.searchQuery.trim().toLowerCase()
        const matchesQuery =
          !query ||
          product.title.toLowerCase().includes(query) ||
          product.seller.toLowerCase().includes(query)
        return matchesCategory && matchesQuery
      })}
      allProducts={products}
      category={category}
      searchQuery={props.searchQuery}
      onSearchChange={props.onSearchChange}
      onSearchSubmit={(term) => navigate(term.trim() ? ROUTES.searchFor(term.trim()) : ROUTES.home)}
      searchRef={props.searchRef}
      favorites={props.favorites}
      onToggleFavorite={props.onToggleFavorite}
      onAddToCart={props.onAddToCart}
      cartCount={props.cartCount}
      notificationCount={props.notificationCount}
      userName={authUser?.name}
      onOpenCart={props.onOpenCart}
      moreHref={userRole === 'admin' ? ROUTES.admin() : ROUTES.profile}
    />
  )

  return (
    <Switch>
      <Route path={ROUTE_PATTERNS.login}>
        <LoginScreen
          authMode={props.authMode}
          onAuthModeChange={props.onAuthModeChange}
          authForm={props.authForm}
          onAuthFormChange={props.onAuthFormChange}
          authError={props.authError}
          onSubmit={props.onAuthSubmit}
          onQuickLogin={props.onQuickLogin}
          isDevMode={props.isDevMode}
        />
      </Route>

      <Route path={ROUTE_PATTERNS.home}>{vitrine('Tudo')}</Route>
      <Route path={ROUTE_PATTERNS.search}>{vitrine('Tudo')}</Route>

      <Route path={ROUTE_PATTERNS.category}>
        {(params) => {
          const category = categoryFromSlug(params.slug ?? '')
          if (!category) {
            return (
              <EmptyState
                Icon={Compass}
                title="Categoria não encontrada"
                message="Esta categoria não existe ou mudou de nome."
                actionLabel="Ver todas as categorias"
                actionHref={ROUTES.categories}
              />
            )
          }
          return vitrine(category)
        }}
      </Route>

      <Route path={ROUTE_PATTERNS.categories}>
        <CategoriesScreen />
      </Route>

      <Route path={ROUTE_PATTERNS.product}>
        {(params) => (
          <ProductScreen
            productId={Number(params.id)}
            favorites={props.favorites}
            onToggleFavorite={props.onToggleFavorite}
            onAddToCart={props.onAddToCart}
            onBuyNow={props.onBuyNow}
          />
        )}
      </Route>

      <Route path={ROUTE_PATTERNS.store}>
        {(params) => (
          <StoreScreen
            slug={params.slug ?? ''}
            favorites={props.favorites}
            onToggleFavorite={props.onToggleFavorite}
            onAddToCart={props.onAddToCart}
          />
        )}
      </Route>

      <Route path={ROUTE_PATTERNS.order}>
        {(params) => {
          const order =
            props.orders.find((item) => item.id === params.id) ??
            (props.currentOrder?.id === params.id ? props.currentOrder : null)
          return <TrackingScreen currentOrder={order} onBack={() => navigate(ROUTES.home)} />
        }}
      </Route>

      <Route path={ROUTE_PATTERNS.profile}>
        <ProfileScreen
          authUser={authUser}
          userRole={userRole}
          businessProfile={props.businessProfile}
          favorites={props.favorites}
          orders={props.orders}
          onBack={() => navigate(ROUTES.home)}
          onLogout={props.onLogout}
          onToggleFavorite={props.onToggleFavorite}
        />
      </Route>

      <Route path={ROUTE_PATTERNS.admin}>
        {(params) => (
          <AdminScreen
            userRole={userRole}
            adminTab={(params.tab as AdminTab | undefined) ?? 'overview'}
            onTabChange={(tab) => navigate(ROUTES.admin(tab))}
            metrics={props.metrics}
            schedule={props.schedule}
            orders={props.orders}
            agents={props.agents}
            agentForm={props.agentForm}
            onAgentFormChange={props.onAgentFormChange}
            onAgentSubmit={props.onAgentSubmit}
            onAgentReset={props.onAgentReset}
            onAgentEdit={props.onAgentEdit}
            onAgentDelete={props.onAgentDelete}
            onStatusChange={props.onStatusChange}
            onBack={() => navigate(ROUTES.home)}
          />
        )}
      </Route>

      <Route>
        <EmptyState
          Icon={Compass}
          title="Página não encontrada"
          message="O endereço acessado não existe. Confira o link ou volte à vitrine."
          actionLabel="Ir para a vitrine"
          actionHref={ROUTES.home}
        />
      </Route>
    </Switch>
  )
}
