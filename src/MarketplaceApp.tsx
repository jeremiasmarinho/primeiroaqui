import BusinessSetupModal from './components/BusinessSetupModal'
import CartDrawer from './components/CartDrawer'
import ToastStack from './components/Toast'
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
        onAuthUserChange={state.onAuthUserChange}
        userRole={state.userRole}
        isDevMode={state.isDevMode}
        authMode={state.authMode}
        onAuthModeChange={state.onAuthModeChange}
        authForm={state.authForm}
        onAuthFormChange={state.onAuthFormChange}
        authError={state.authError}
        onAuthSubmit={state.onAuthSubmit}
        authPending={state.authPending}
        onQuickLogin={state.onQuickLogin}
        onGoogleLogin={state.onGoogleLogin}
        onLogout={state.onLogout}
        onRequireLogin={state.onRequireLogin}
        loginContextMessage={state.loginContextMessage}
        onBecomeStoreOwner={state.onBecomeStoreOwner}
        forgotPasswordOpen={state.forgotPasswordOpen}
        forgotEmail={state.forgotEmail}
        onForgotEmailChange={state.onForgotEmailChange}
        forgotStatus={state.forgotStatus}
        forgotError={state.forgotError}
        onOpenForgotPassword={state.onOpenForgotPassword}
        onCloseForgotPassword={state.onCloseForgotPassword}
        onForgotPasswordSubmit={state.onForgotPasswordSubmit}
        onPasswordResetSuccess={state.onPasswordResetSuccess}
        onOAuthComplete={state.onOAuthComplete}
        onOAuthError={state.onOAuthError}
        products={state.products}
        productsLoading={state.productsLoading}
        productsError={state.productsError}
        onRetryProducts={state.onRetryProducts}
        categories={state.categories}
        searchQuery={state.searchQuery}
        onSearchChange={state.onSearchChange}
        searchRef={state.searchInputRef}
        favorites={state.favorites}
        onToggleFavorite={state.onToggleFavorite}
        onAddToCart={state.onAddToCart}
        onBuyNow={state.onBuyNow}
        cartCount={state.cartCount}
        notifications={state.notifications}
        notificationCount={state.notificationCount}
        onNotificationsOpen={state.onNotificationsOpen}
        onOpenCart={state.onOpenCart}
        orders={state.orders}
        ordersLoading={state.ordersLoading}
        ordersError={state.ordersError}
        onRetryOrders={state.onRetryOrders}
        currentOrder={state.currentOrder}
        onRepeatOrder={state.onRepeatOrder}
        repeatError={state.repeatError}
        businessProfile={state.businessProfile}
        addresses={state.addresses}
        addressesLoading={state.addressesLoading}
        addressesError={state.addressesError}
        addressLine={state.addressLine}
        addressForm={state.addressForm}
        addressError={state.addressError}
        onAddressFormChange={state.onAddressFormChange}
        onAddressSubmit={state.onAddressSubmit}
        addressSubmitting={state.addressSubmitting}
        cepLookupPending={state.cepLookupPending}
        cepNotFound={state.cepNotFound}
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
        isConfirming={state.isConfirmingOrder}
        paymentOrder={state.paymentOrder}
        paymentIndex={state.paymentIndex}
        totalPayments={state.totalPayments}
        paymentCardForm={state.paymentCardForm}
        paymentCustomerForm={state.paymentCustomerForm}
        paymentFieldErrors={state.paymentFieldErrors}
        paymentStatus={state.paymentStatus}
        paymentErrorMessage={state.paymentErrorMessage}
        pixData={state.pixData}
        pixPaymentStatus={state.pixPaymentStatus}
        paymentPublicKey={state.paymentPublicKey}
        paymentConfigError={state.paymentConfigError}
        onPaymentCardFormChange={state.onPaymentCardFormChange}
        onPaymentCustomerFormChange={state.onPaymentCustomerFormChange}
        onPaymentSubmit={state.onPaymentSubmit}
        onPaymentContinue={state.onPaymentContinue}
      />

      <ToastStack />
    </>
  )
}
