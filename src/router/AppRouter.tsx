import { Compass } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Redirect, Route, Switch, useLocation } from 'wouter'

import EmptyState from '../components/EmptyState'
import AddressesScreen from '../screens/AddressesScreen'
import CategoriesScreen from '../screens/CategoriesScreen'
import FavoritesScreen from '../screens/FavoritesScreen'
import HomeScreen from '../screens/HomeScreen'
import LoginScreen from '../screens/LoginScreen'
import OrdersScreen from '../screens/OrdersScreen'
import ProductScreen from '../screens/ProductScreen'
import ProfileScreen from '../screens/ProfileScreen'
import StoreScreen from '../screens/StoreScreen'
import TrackingScreen from '../screens/TrackingScreen'
import type { AdminTab } from '../screens/admin/AdminScreen'

import type { AppRouterProps } from './AppRouterProps'
import { ROUTE_PATTERNS, ROUTES, isProtected, toCategorySlug } from './routes'
import { categories, products } from '../data/catalog'
import type { Category } from '../types'

export type { AppRouterProps }

/**
 * Code splitting do painel admin (WU perf/A-SETUP): quem compra nunca abre
 * `/admin`, então o bundle da operação não deveria pesar no carregamento
 * inicial do comprador. `React.lazy` baixa esse chunk só quando a rota é
 * visitada.
 */
const AdminScreen = lazy(() => import('../screens/admin/AdminScreen'))

/** Fallback acessível enquanto o chunk do painel admin carrega. */
const AdminScreenFallback = () => (
  <div role="status" className="grid min-h-dvh place-items-center bg-surface-page p-6">
    <p className="text-sm font-semibold text-ink-muted">Carregando…</p>
  </div>
)

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

  const moreHref = userRole === 'admin' ? ROUTES.admin() : ROUTES.profile

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
      address={props.addressLine}
      onOpenCart={props.onOpenCart}
      moreHref={moreHref}
      isAuthenticated={!!authUser}
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

      <Route path={ROUTE_PATTERNS.favorites}>
        <FavoritesScreen
          favorites={props.favorites}
          onToggleFavorite={props.onToggleFavorite}
          onAddToCart={props.onAddToCart}
          onOpenCart={props.onOpenCart}
          cartCount={props.cartCount}
          moreHref={moreHref}
        />
      </Route>

      <Route path={ROUTE_PATTERNS.orders}>
        <OrdersScreen
          orders={props.orders}
          onRepeatOrder={props.onRepeatOrder}
          repeatError={props.repeatError}
          onOpenCart={props.onOpenCart}
          cartCount={props.cartCount}
          favoritesCount={props.favorites.length}
          moreHref={moreHref}
        />
      </Route>

      <Route path={ROUTE_PATTERNS.addresses}>
        <AddressesScreen
          addresses={props.addresses}
          addressForm={props.addressForm}
          addressError={props.addressError}
          onAddressFormChange={props.onAddressFormChange}
          onAddressSubmit={props.onAddressSubmit}
          onSetDefaultAddress={props.onSetDefaultAddress}
          onRemoveAddress={props.onRemoveAddress}
        />
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
          <Suspense fallback={<AdminScreenFallback />}>
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
          </Suspense>
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
