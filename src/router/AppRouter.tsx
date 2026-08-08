import { Compass } from 'lucide-react'
import { lazy, Suspense, useEffect } from 'react'
import { Redirect, Route, Switch, useLocation } from 'wouter'

import EmptyState from '../components/EmptyState'
import HomeScreen from '../screens/HomeScreen'
import LoginScreen from '../screens/LoginScreen'

import ProductScreen from '../screens/ProductScreen'

import StoreScreen from '../screens/StoreScreen'
import type { AdminTab } from '../screens/admin/AdminScreen'

import type { AppRouterProps } from './AppRouterProps'
import { ROUTE_PATTERNS, ROUTES, isProtected, toCategorySlug } from './routes'
import type { Category } from '../types'

export type { AppRouterProps }

/**
 * Code splitting do painel admin (WU perf/A-SETUP): quem compra nunca abre
 * `/admin`, então o bundle da operação não deveria pesar no carregamento
 * inicial do comprador. `React.lazy` baixa esse chunk só quando a rota é
 * visitada.
 */
const AdminScreen = lazy(() => import('../screens/admin/AdminScreen'))
// Telas de fluxo raro (link de e-mail, retorno OAuth): fora do bundle inicial.
const ResetPasswordScreen = lazy(() => import('../screens/ResetPasswordScreen'))
const OAuthCallbackScreen = lazy(() => import('../screens/OAuthCallbackScreen'))

/**
 * Mesmo racional do AdminScreen: o painel do lojista não deve pesar no bundle
 * de quem só compra.
 */
const StoreDashboardScreen = lazy(() => import('../screens/store/StoreDashboardScreen'))

/**
 * WU perf/B-BUDGET: telas fora do caminho crítico da primeira dobra (Home /
 * Product / Store / Login ficam eager). Code splitting libera espaço no
 * orçamento de bundle inicial para a feature de notificações.
 */
const CategoriesScreen = lazy(() => import('../screens/CategoriesScreen'))
const FavoritesScreen = lazy(() => import('../screens/FavoritesScreen'))
const AddressesScreen = lazy(() => import('../screens/AddressesScreen'))
const OrdersScreen = lazy(() => import('../screens/OrdersScreen'))
const ProfileScreen = lazy(() => import('../screens/ProfileScreen'))

/** Fallback acessível enquanto o chunk do painel admin carrega. */
const AdminScreenFallback = () => (
  <div role="status" className="grid min-h-dvh place-items-center bg-surface-page p-6">
    <p className="text-sm font-semibold text-ink-muted">Carregando…</p>
  </div>
)

// Slug -> categoria real, resolvido contra a lista derivada do catálogo
// carregado (o backend não tem endpoint de categorias).
const categoryFromSlug = (categories: Category[], slug: string): Category | null =>
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

  const requiresLogin = !authUser && isProtected(location)

  // Guarda de sessão: rota protegida sem usuário volta para o login. `replace`
  // evita que o botão voltar caia de novo na rota bloqueada. O efeito registra
  // o destino de retorno; o fechamento (`location`) captura o valor desta
  // renderização, então a ordem entre este efeito e o do <Redirect> não importa.
  useEffect(() => {
    if (requiresLogin) {
      props.onRequireLogin(location)
    }
  }, [requiresLogin, location, props.onRequireLogin])

  if (requiresLogin) {
    return <Redirect href={ROUTES.login} replace />
  }

  if (authUser && location === ROUTES.login) {
    return <Redirect href={ROUTES.home} replace />
  }

  const moreHref = !authUser ? ROUTES.login : userRole === 'ADMIN' ? ROUTES.admin() : ROUTES.profile

  const vitrine = (category: Category) => (
    <HomeScreen
      products={props.products.filter((product) => {
        const matchesCategory = category === 'Tudo' || product.category === category
        const query = props.searchQuery.trim().toLowerCase()
        const matchesQuery =
          !query ||
          product.title.toLowerCase().includes(query) ||
          product.seller.toLowerCase().includes(query)
        return matchesCategory && matchesQuery
      })}
      allProducts={props.products}
      categories={props.categories}
      isLoading={props.productsLoading}
      loadError={props.productsError}
      onRetry={props.onRetryProducts}
      category={category}
      searchQuery={props.searchQuery}
      onSearchChange={props.onSearchChange}
      onSearchSubmit={(term) => navigate(term.trim() ? ROUTES.searchFor(term.trim()) : ROUTES.home)}
      searchRef={props.searchRef}
      favorites={props.favorites}
      onToggleFavorite={props.onToggleFavorite}
      onAddToCart={props.onAddToCart}
      cartCount={props.cartCount}
      notifications={props.notifications}
      notificationCount={props.notificationCount}
      onNotificationsOpen={props.onNotificationsOpen}
      userName={authUser?.name}
      userAvatarUrl={authUser?.avatarUrl}
      address={props.addressLine}
      onOpenCart={props.onOpenCart}
      moreHref={moreHref}
      isAuthenticated={!!authUser}
    />
  )

  return (
    <Switch>
      <Route path={ROUTE_PATTERNS.oauthCallback}>
        <OAuthCallbackScreen onComplete={props.onOAuthComplete} onError={props.onOAuthError} />
      </Route>

      <Route path={ROUTE_PATTERNS.login}>
        <LoginScreen
          authMode={props.authMode}
          onAuthModeChange={props.onAuthModeChange}
          authForm={props.authForm}
          onAuthFormChange={props.onAuthFormChange}
          authError={props.authError}
          onSubmit={props.onAuthSubmit}
          authPending={props.authPending}
          onQuickLogin={props.onQuickLogin}
          onGoogleLogin={props.onGoogleLogin}
          isDevMode={props.isDevMode}
          contextMessage={props.loginContextMessage}
          forgotPasswordOpen={props.forgotPasswordOpen}
          forgotEmail={props.forgotEmail}
          onForgotEmailChange={props.onForgotEmailChange}
          forgotStatus={props.forgotStatus}
          forgotError={props.forgotError}
          onOpenForgotPassword={props.onOpenForgotPassword}
          onCloseForgotPassword={props.onCloseForgotPassword}
          onForgotPasswordSubmit={props.onForgotPasswordSubmit}
        />
      </Route>

      <Route path={ROUTE_PATTERNS.resetPassword}>
        <ResetPasswordScreen onSuccess={props.onPasswordResetSuccess} />
      </Route>

      <Route path={ROUTE_PATTERNS.home}>{vitrine('Tudo')}</Route>
      <Route path={ROUTE_PATTERNS.search}>{vitrine('Tudo')}</Route>

      <Route path={ROUTE_PATTERNS.category}>
        {(params) => {
          const category = categoryFromSlug(props.categories, params.slug ?? '')
          // Enquanto o catálogo carrega, a lista de categorias ainda não
          // existe — mostrar a vitrine (com skeleton) em vez de "não existe".
          if (!category && props.productsLoading) return vitrine('Tudo')
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
        <Suspense fallback={<AdminScreenFallback />}>
          <CategoriesScreen
            categories={props.categories}
            products={props.products}
            isLoading={props.productsLoading}
            error={props.productsError}
          />
        </Suspense>
      </Route>

      <Route path={ROUTE_PATTERNS.product}>
        {(params) => (
          <ProductScreen
            productId={params.id ?? ''}
            allProducts={props.products}
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
            storeId={params.slug ?? ''}
            allProducts={props.products}
            favorites={props.favorites}
            onToggleFavorite={props.onToggleFavorite}
            onAddToCart={props.onAddToCart}
          />
        )}
      </Route>

      {/* Rastreio OCULTO no MVP: a TrackingScreen simulava progresso de entrega
          sem backend por tras. Deep links caem no historico real de pedidos.
          Religar quando houver tracking de verdade. */}
      <Route path={ROUTE_PATTERNS.order}>
        <Redirect to={ROUTES.orders} replace />
      </Route>

      <Route path={ROUTE_PATTERNS.favorites}>
        <Suspense fallback={<AdminScreenFallback />}>
          <FavoritesScreen
            favorites={props.favorites}
            onToggleFavorite={props.onToggleFavorite}
            onAddToCart={props.onAddToCart}
            onOpenCart={props.onOpenCart}
            cartCount={props.cartCount}
            moreHref={moreHref}
          />
        </Suspense>
      </Route>

      <Route path={ROUTE_PATTERNS.orders}>
        <Suspense fallback={<AdminScreenFallback />}>
          <OrdersScreen
            orders={props.orders}
            isLoading={props.ordersLoading}
            error={props.ordersError}
            onRetry={props.onRetryOrders}
            onRepeatOrder={props.onRepeatOrder}
            repeatError={props.repeatError}
            onOpenCart={props.onOpenCart}
            cartCount={props.cartCount}
            favoritesCount={props.favorites.length}
            moreHref={moreHref}
          />
        </Suspense>
      </Route>

      <Route path={ROUTE_PATTERNS.addresses}>
        <Suspense fallback={<AdminScreenFallback />}>
          <AddressesScreen
            addresses={props.addresses}
            isLoading={props.addressesLoading}
            error={props.addressesError}
            addressForm={props.addressForm}
            addressError={props.addressError}
            onAddressFormChange={props.onAddressFormChange}
            onAddressSubmit={props.onAddressSubmit}
            isSubmitting={props.addressSubmitting}
            isCepLookupPending={props.cepLookupPending}
          />
        </Suspense>
      </Route>

      <Route path={ROUTE_PATTERNS.profile}>
        <Suspense fallback={<AdminScreenFallback />}>
          <ProfileScreen
            authUser={authUser}
            onAuthUserChange={props.onAuthUserChange}
            userRole={userRole}
            businessProfile={props.businessProfile}
            favorites={props.favorites}
            orders={props.orders}
            onBack={() => navigate(ROUTES.home)}
            onLogout={props.onLogout}
            onToggleFavorite={props.onToggleFavorite}
            onBecomeStoreOwner={props.onBecomeStoreOwner}
          />
        </Suspense>
      </Route>

      <Route path={ROUTE_PATTERNS.myStore}>
        <Suspense fallback={<AdminScreenFallback />}>
          <StoreDashboardScreen userRole={userRole} />
        </Suspense>
      </Route>

      <Route path={ROUTE_PATTERNS.admin}>
        {(params) => (
          <Suspense fallback={<AdminScreenFallback />}>
            <AdminScreen
              userRole={userRole}
              adminTab={(params.tab as AdminTab | undefined) ?? 'overview'}
              onTabChange={(tab) => navigate(ROUTES.admin(tab))}
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
