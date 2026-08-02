import BusinessSetupModal from './components/BusinessSetupModal'
import CartDrawer from './components/CartDrawer'
import AppRouter from './router/AppRouter'
import { useMarketplaceState } from './state/useMarketplaceState'

/**
 * Composição raiz do app: todo o estado e os handlers vêm de
 * `useMarketplaceState`. Este componente só monta as telas.
 */
export default function MarketplaceApp() {
  const state = useMarketplaceState()

  return (
    <>
      <AppRouter
        authUser={state.authUser}
        userRole={state.userRole}
        isDevMode={state.isDevMode}
        authMode={state.authMode}
        onAuthModeChange={state.onAuthModeChange}
        authForm={state.authForm}
        onAuthFormChange={state.onAuthFormChange}
        authError={state.authError}
        onAuthSubmit={state.onAuthSubmit}
        onQuickLogin={state.onQuickLogin}
        onLogout={state.onLogout}
        onRequireLogin={state.onRequireLogin}
        loginContextMessage={state.loginContextMessage}
        searchQuery={state.searchQuery}
        onSearchChange={state.onSearchChange}
        searchRef={state.searchInputRef}
        favorites={state.favorites}
        onToggleFavorite={state.onToggleFavorite}
        onAddToCart={state.onAddToCart}
        onBuyNow={state.onBuyNow}
        cartCount={state.cartCount}
        notificationCount={state.notificationCount}
        onOpenCart={state.onOpenCart}
        orders={state.orders}
        currentOrder={state.currentOrder}
        onRepeatOrder={state.onRepeatOrder}
        repeatError={state.repeatError}
        agents={state.agents}
        schedule={state.schedule}
        metrics={state.metrics}
        agentForm={state.agentForm}
        onAgentFormChange={state.onAgentFormChange}
        onAgentSubmit={state.onAgentSubmit}
        onAgentReset={state.onAgentReset}
        onAgentEdit={state.onAgentEdit}
        onAgentDelete={state.onAgentDelete}
        onStatusChange={state.onStatusChange}
        businessProfile={state.businessProfile}
        addresses={state.addresses}
        addressLine={state.addressLine}
        addressForm={state.addressForm}
        addressError={state.addressError}
        onAddressFormChange={state.onAddressFormChange}
        onAddressSubmit={state.onAddressSubmit}
        onSetDefaultAddress={state.onSetDefaultAddress}
        onRemoveAddress={state.onRemoveAddress}
      />

      <BusinessSetupModal
        open={state.isSetupOpen}
        form={state.setupForm}
        onChange={state.onSetupFormChange}
        onSubmit={state.onBusinessSetupSubmit}
        onClose={state.onSetupClose}
      />

      <CartDrawer
        open={state.isCartOpen}
        step={state.checkoutStep}
        cartState={state.cartState}
        deliveryForm={state.deliveryForm}
        checkoutError={state.checkoutError}
        couponCode={state.couponCode}
        couponError={state.couponError}
        discount={state.discount}
        addresses={state.addresses}
        selectedAddressId={state.selectedAddressId}
        onSelectAddress={state.onSelectAddress}
        onClose={state.onCartClose}
        onIncrement={state.onCartIncrement}
        onDecrement={state.onCartDecrement}
        onRemove={state.onCartRemove}
        onDeliveryChange={state.onDeliveryChange}
        onCouponCodeChange={state.onCouponCodeChange}
        onApplyCoupon={state.onApplyCoupon}
        onRemoveCoupon={state.onRemoveCoupon}
        onContinue={state.onCartContinue}
        onConfirm={state.onCartConfirm}
      />
    </>
  )
}
