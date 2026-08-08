import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'wouter'

import { ROUTES, toCategorySlug } from '../router/routes'
import type { AuthForm } from '../screens/LoginScreen'
import { writeStoredJSON } from '../lib/storage'
import { hardNavigate } from '../lib/hardNavigate'
import { api, ApiError, invalidateRefresh, loadStoredSession, setOnUnauthorized } from '../lib/api'
import { favoriteToViewProduct, toViewOrder, toViewProduct } from '../lib/adapters'
import { clearCart, replaceCart } from './cart'
import { repeatOrder } from './orders'
import { STORAGE_KEYS, clearSession } from './session'
import { pendingIntentMessage } from './pendingIntent'
import { EMPTY_DELIVERY, initialThreads, EMPTY_BUSINESS } from './marketplaceSeed'
import { pushToast } from './useToasts'
import { useSessionState } from './useSessionState'
import { useCatalogState } from './useCatalogState'
import { useRemoteCatalog } from './useRemoteCatalog'
import { useCartCheckoutState } from './useCartCheckoutState'
import { usePaymentCheckoutState } from './usePaymentCheckoutState'
import { useBusinessSetupState } from './useBusinessSetupState'
import { useAddressesState } from './useAddressesState'
import { CEP_ERROR_MESSAGE, addressToDeliveryPatch, formatAddress, isValidCep } from './addresses'
import type { Order, Product, Role } from '../types'

/**
 * Estado e handlers do marketplace inteiro: sessão, vitrine, carrinho,
 * checkout e painel admin. `MarketplaceApp` só compõe as telas com o que
 * este hook devolve — nenhuma lógica de negócio mora no componente.
 *
 * Fase de integração: catálogo, sessão, favoritos, endereços e pedidos agora
 * vêm da API real (`src/lib/api.ts`). O painel admin e o rastreio seguem
 * mock — outra fase cuida deles.
 */
/** Mensagem pt-BR do backend quando houver (erro de rede/status 0 cai no fallback local). */
const apiErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof ApiError && err.status > 0 ? err.message : fallback

export function useMarketplaceState() {
  const [location, navigate] = useLocation()

  const catalog = useCatalogState()
  const remoteCatalog = useRemoteCatalog()
  const cartCheckout = useCartCheckoutState()
  // Fecha a gaveta do carrinho antes de qualquer redirecionamento para
  // /entrar: veja o comentário de `onBeforeRedirect` em useSessionState.
  const session = useSessionState(navigate, () => cartCheckout.setIsCartOpen(false))
  // `session.authUser` precisa existir ANTES de montar o pagamento: telefone
  // e CPF salvos no perfil pré-preenchem o checkout (ver precedência em
  // usePaymentCheckoutState.ts).
  const payment = usePaymentCheckoutState(session.authUser)
  const admin = useBusinessSetupState()
  const addresses = useAddressesState(!!session.authUser)
  const [repeatError, setRepeatError] = useState('')
  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false)

  // ------------------------------------------------------------------
  // Pedidos reais (GET /api/me/orders)
  // ------------------------------------------------------------------
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [ordersReloadKey, setOrdersReloadKey] = useState(0)

  const hasSession = !!session.authUser

  // Nome da loja por pedido: sem endpoint novo, deriva de storeId → nome a
  // partir do catálogo já carregado (mesmo `seller` mostrado nos cards de
  // produto). Loja fora do catálogo carregado fica sem nome — a tela
  // degrada em vez de inventar dado de backend.
  const storeNameById = useMemo(
    () =>
      new Map(
        remoteCatalog.products
          .filter((product) => product.storeId && product.seller)
          .map((product) => [product.storeId as string, product.seller]),
      ),
    [remoteCatalog.products],
  )

  useEffect(() => {
    if (!hasSession || !loadStoredSession()) {
      setMyOrders([])
      return
    }
    let cancelled = false
    setOrdersLoading(true)
    setOrdersError('')
    api
      .listMyOrders()
      .then(({ orders }) => {
        if (cancelled) return
        const titleById = new Map(
          remoteCatalog.products.map((product) => [product.id, product.title]),
        )
        setMyOrders(orders.map((order) => toViewOrder(order, titleById, storeNameById)))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setOrdersError(apiErrorMessage(err, 'Não foi possível carregar seus pedidos.'))
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false)
      })
    return () => {
      cancelled = true
    }
    // remoteCatalog.products só melhora os títulos exibidos; recarregar a cada
    // mudança do catálogo seria requisição à toa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession, ordersReloadKey])

  const titleById = useMemo(
    () => new Map(remoteCatalog.products.map((product) => [product.id, product.title])),
    [remoteCatalog.products],
  )

  // /me/orders e /products (catálogo, fonte do nome da loja e dos títulos)
  // carregam em paralelo — se o catálogo chega depois, `storeNameById`/
  // `titleById` estavam vazios no momento do map original em `toViewOrder` e
  // o nome da loja/dos itens nunca era resolvido. Reaplica aqui, fora da
  // corrida entre as duas requisições. `lines` (usado por `onRepeatOrder`)
  // não muda, só a projeção de exibição.
  const ordersForView = useMemo(
    () =>
      myOrders.map((order) => ({
        ...order,
        storeName:
          order.storeName ?? (order.storeId ? storeNameById.get(order.storeId) : undefined),
        items: order.lines?.length
          ? order.lines.map((line) => titleById.get(line.productId) ?? 'Produto')
          : order.items,
      })),
    [myOrders, storeNameById, titleById],
  )

  // ------------------------------------------------------------------
  // Favoritos reais (GET /api/me/favorites): hidrata a fatia local.
  // ------------------------------------------------------------------
  /**
   * Produto favoritado OTIMISTICAMENTE pela intenção pendente, ainda não
   * confirmado pelo servidor — a hidratação abaixo (`.then`) consulta este
   * ref para não apagá-lo se ela resolver DEPOIS do toggle otimista.
   *
   * Por que não simplesmente `await` a hidratação antes de favoritar (versão
   * anterior desta correção): no exato momento do login, o efeito de
   * hidratação e o de "continuação pós-reload" disparam JUNTOS (os dois
   * reagem a `hasSession` virando true), e cada round-trip extra encadeado
   * (esperar a hidratação, depois buscar o produto por id) empurra o
   * favorito otimista mais pra frente no tempo — numa suíte e2e que navega
   * de novo logo em seguida (retry de asserção com `page.goto`), a
   * navegação cancela o fetch em voo ANTES da resolução terminar, perdendo o
   * favorito (bug real, e2e/jornada-visitante.spec.ts). Mesclar com o ref é
   * mais rápido (sem await extra) e igualmente à prova da corrida.
   */
  const optimisticFavoriteRef = useRef<Product | null>(null)
  useEffect(() => {
    if (!hasSession || !loadStoredSession()) return
    let cancelled = false
    api
      .listFavorites()
      .then(({ products }) => {
        if (cancelled) return
        const serverFavorites = products.map(favoriteToViewProduct)
        const pending = optimisticFavoriteRef.current
        catalog.setFavorites(
          pending && !serverFavorites.some((item) => item.id === pending.id)
            ? [...serverFavorites, pending]
            : serverFavorites,
        )
      })
      .catch(() => {
        // Silencioso: favoritos são conveniência; a lista local segue como cache.
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession])

  // ------------------------------------------------------------------
  // Sessão derrubada (logout ou 401): limpar tudo que é da pessoa.
  // ------------------------------------------------------------------
  const dropLocalSession = useCallback(() => {
    clearSession()
    session.setAuthUser(null)
    session.setUserRole('BUYER')
    cartCheckout.dispatchCart(clearCart())
    catalog.setFavorites([])
    catalog.setMessageThreads(initialThreads)
    admin.setBusinessProfile(null)
    admin.setSetupForm(EMPTY_BUSINESS)
    admin.setCurrentOrder(null)
    addresses.setAddresses([])
    addresses.setSelectedAddressId('')
    setMyOrders([])
    // Setters de useState são estáveis; os hooks de fatia não mudam entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setOnUnauthorized(() => dropLocalSession())
    return () => setOnUnauthorized(null)
  }, [dropLocalSession])

  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.notifications, catalog.notifications)
  }, [catalog.notifications])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.user, session.authUser)
  }, [session.authUser])

  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.cart, cartCheckout.cartState)
  }, [cartCheckout.cartState])
  // Favoritos persistem como cache apenas com sessão ativa: sem isso, os
  // favoritos de quem saiu vazam para o próximo login (regressões B3 e B4).
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.favorites, session.authUser ? catalog.favorites : null)
  }, [session.authUser, catalog.favorites])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.messages, session.authUser ? catalog.messageThreads : null)
  }, [session.authUser, catalog.messageThreads])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.currentOrder, session.authUser ? admin.currentOrder : null)
  }, [session.authUser, admin.currentOrder])
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.business, session.authUser ? admin.businessProfile : null)
  }, [session.authUser, admin.businessProfile])

  /**
   * Ordem importa (corrida do refresh em voo — "sessão ressuscitada" depois
   * de sair): capturar a sessão atual → limpar o storage IMEDIATAMENTE, antes
   * de qualquer await → invalidar a geração do single-flight de refresh (um
   * refresh que já estava em voo e resolve DEPOIS não pode regravar a sessão
   * que acabou de ser encerrada, ver `invalidateRefresh` em api.ts) → disparar
   * o logout no servidor com o token capturado (fire-and-forget; o storage já
   * não tem mais nada para `api.logout()` ler sozinho) → navegação dura para
   * a home, garantindo caches e estado 100% frescos.
   */
  const handleLogout = () => {
    const current = loadStoredSession()
    clearSession()
    invalidateRefresh()
    if (current) {
      api.logout(current.accessToken).catch(() => {})
    }
    dropLocalSession()
    hardNavigate(ROUTES.home)
  }

  /** Escolher endereço salvo preenche a entrega — o campo segue editável. */
  const handleSelectAddress = (id: string) => {
    const address = addresses.addresses.find((item) => item.id === id)
    if (!address) return

    addresses.setSelectedAddressId(id)
    cartCheckout.setDeliveryForm((prev) => ({
      ...prev,
      ...addressToDeliveryPatch(address),
    }))
  }

  const handleCartContinue = () => {
    if (cartCheckout.cartItemsCount === 0) return

    // O padrão entra sozinho no primeiro acesso à entrega; se a pessoa já
    // escolheu outro endereço, a escolha dela vence.
    const suggested = addresses.defaultAddress
    if (suggested && !addresses.selectedAddressId) {
      handleSelectAddress(suggested.id)
    }

    cartCheckout.setCheckoutStep('delivery')
  }

  const notifyFavoriteError = (err: unknown) =>
    catalog.addNotification(
      'Favoritos',
      apiErrorMessage(err, 'Não foi possível atualizar seus favoritos.'),
      'warning',
    )

  /**
   * Otimista: a UI muda na hora e a API confirma atrás. Se a chamada falhar,
   * reverte e avisa — coração que "desmarca sozinho" sem explicação é bug.
   */
  const toggleFavoriteWithApi = (product: Product) => {
    const wasFavorite = catalog.favorites.some((item) => item.id === product.id)
    catalog.toggleFavorite(product)
    pushToast(wasFavorite ? 'Removido dos favoritos' : 'Favorito salvo', 'success')

    const call = wasFavorite ? api.removeFavorite(product.id) : api.addFavorite(product.id)
    call.catch((err: unknown) => {
      catalog.toggleFavorite(product)
      notifyFavoriteError(err)
    })
  }

  /**
   * IDEMPOTENTE — "garante favoritado", nunca desfavorita. Usada só pela
   * resolução da intenção pendente (`resolveFavoriteIntent`).
   *
   * `toggleFavoriteWithApi` inverte o estado atual, o que é certo para um
   * clique explícito no coração — mas errado aqui: a intenção pendente pode
   * ser resolvida mais de uma vez ao longo de um mesmo login (ex.: reload de
   * verdade — resolvida uma vez antes do reload, outra depois), e a
   * hidratação de /me/favorites que roda em paralelo pode já ter marcado o
   * produto como favorito nesse meio-tempo. Com um toggle, essa segunda
   * resolução DESFAVORITARIA o produto (bug real, pego pelo teste "sobrevive
   * a um reload de verdade"). "Garantir favoritado" é seguro chamar quantas
   * vezes for preciso.
   */
  const ensureFavorited = (product: Product) => {
    optimisticFavoriteRef.current = product
    catalog.setFavorites((prev) => (prev.some((item) => item.id === product.id) ? prev : [...prev, product]))
    pushToast('Favorito salvo', 'success')
    api
      .addFavorite(product.id)
      .catch((err: unknown) => {
        catalog.setFavorites((prev) => prev.filter((item) => item.id !== product.id))
        notifyFavoriteError(err)
      })
      // Servidor já confirmou (ou recusou) — a partir daqui a próxima
      // hidratação pode confiar 100% na resposta dele, sem merge.
      .finally(() => {
        if (optimisticFavoriteRef.current === product) optimisticFavoriteRef.current = null
      })
  }

  const guardedToggleFavorite = (product: Product) => {
    if (!session.authUser) {
      session.redirectToLogin(location, { type: 'favorite', productId: product.id })
      return
    }
    toggleFavoriteWithApi(product)
  }

  const guardedCartContinue = () => {
    if (cartCheckout.cartItemsCount === 0) return
    if (!session.authUser) {
      // Fechamento da gaveta: ver onBeforeRedirect em redirectToLogin.
      session.redirectToLogin(location, { type: 'resume-checkout' })
      return
    }
    handleCartContinue()
  }

  const guardedBuyNow = (product: Product) => {
    if (!session.authUser) {
      cartCheckout.handleAddToCart(product)
      session.redirectToLogin(location, { type: 'resume-checkout' })
      return
    }
    cartCheckout.handleBuyNow(product)
  }

  /**
   * Resolve a intenção de favoritar: tenta achar o produto no catálogo já
   * carregado (rápido, sem round-trip) e, se não achar, busca DIRETO por id
   * (GET /products/:id) em vez de esperar/depender do catálogo paginado.
   *
   * Bug real corrigido aqui (e2e/jornada-visitante.spec.ts): a versão
   * anterior só esperava `remoteCatalog.products.length > 0` antes de tentar
   * `products.find(...)` — mas GET /products é uma janela de até 50 itens
   * (ver useRemoteCatalog.ts), então um catálogo "carregado" (length > 0)
   * não garante que o produto favoritado esteja nela. Quando não estava, o
   * `.find` falhava, a intenção era descartada e o `pendingLoginResolvedRef`
   * (efeito abaixo) já marcava tudo como "resolvido" — o favorito virava
   * no-op silencioso PERMANENTE, sem qualquer novo POST /favorites. Buscar
   * o produto direto por id elimina essa dependência de janela/paginação:
   * funciona não importa quantos produtos existam ou em que ordem cheguem.
   *
   * Usa `ensureFavorited` (idempotente e otimista — marca
   * `optimisticFavoriteRef` para sobreviver a uma hidratação
   * concorrente de /me/favorites, ver a declaração do ref), não
   * `toggleFavoriteWithApi`: essa resolução pode rodar mais de uma vez ao
   * longo de um mesmo login (ex.: reload de verdade — resolvida uma vez
   * antes do reload, outra depois) e um toggle desfavoritaria na segunda
   * vez. De propósito SEM nenhum await antes do `cached`/fetch: cada round
   * trip a mais é uma chance a mais de uma navegação (ex.: retry de teste
   * e2e com `page.goto`) cancelar o fetch em voo antes do favorito
   * persistir — ver e2e/jornada-visitante.spec.ts.
   */
  const resolveFavoriteIntent = async (productId: string): Promise<void> => {
    const cached = remoteCatalog.products.find((item) => item.id === productId)
    // Sem cache: busca por id (produto pode ter saído do catálogo/sido
    // removido — degrada em silêncio, `null` = nada para favoritar).
    const product =
      cached ??
      (await api
        .getProduct(productId)
        .then((res) => toViewProduct(res.product))
        .catch(() => null))
    if (product) ensureFavorited(product)
  }

  /** Roda depois de login/cadastro bem-sucedido: resolve a intenção pendente e volta para onde a pessoa estava. */
  const resolvePendingLoginAndNavigate = async (): Promise<void> => {
    const intent = session.pendingIntent
    if (intent?.type === 'favorite') {
      await resolveFavoriteIntent(intent.productId)
    } else if (intent?.type === 'resume-checkout') {
      handleCartContinue()
      cartCheckout.setIsCartOpen(true)
    }
    navigate(session.pendingReturnTo ?? ROUTES.home)
    session.clearPendingLogin()
  }

  /**
   * Única trava, usada só pelo efeito abaixo (nenhum outro ponto de entrada
   * chama `resolvePendingLoginAndNavigate` diretamente — ver por quê no
   * comentário do efeito).
   */
  const pendingLoginResolvedRef = useRef(false)

  /**
   * Resolve a intenção pendente (favoritar/retomar checkout) depois de
   * QUALQUER login — senha/Google (pós-reload) OU o atalho rápido de
   * desenvolvimento. SEMPRE via este efeito, nunca chamando
   * `resolvePendingLoginAndNavigate` direto de dentro do handler de clique:
   * um ponto de entrada único, guardado por `pendingLoginResolvedRef`, evita
   * que o handler de clique E este efeito (ambos reagindo ao mesmo login)
   * disparem a resolução duas vezes para a mesma intenção — a segunda vez
   * desfavoritaria o produto se usasse um toggle simples (por isso
   * `ensureFavorited`, acima, é idempotente por design).
   */
  useEffect(() => {
    if (pendingLoginResolvedRef.current) return
    if (!hasSession) return
    if (!session.pendingIntent && !session.pendingReturnTo) return
    pendingLoginResolvedRef.current = true
    void resolvePendingLoginAndNavigate()
  }, [hasSession, session.pendingIntent, session.pendingReturnTo])

  /**
   * `session.handleAuthSubmit` já faz o `hardNavigate` sozinho no sucesso
   * (senha ou signup+login) — nenhum trabalho de navegação sobra pra cá; a
   * intenção pendente é resolvida depois do reload, ver o efeito acima.
   */
  const onAuthSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    void session.handleAuthSubmit(event)
  }

  /**
   * Login rápido de desenvolvimento: NÃO recarrega a página (diferente do
   * login por senha/Google, que faz hardNavigate). Sem intenção pendente,
   * navega na hora — não há nada para o efeito acima resolver, então não
   * há motivo para esperar por ele. COM intenção pendente, deixa o efeito
   * cuidar (ver o comentário longo na declaração dele): só ele garante a
   * ordem correta em relação à hidratação de favoritos.
   */
  const onQuickLogin = (role: Role) => {
    session.handleQuickLogin(role)
    if (!session.pendingIntent && !session.pendingReturnTo) {
      navigate(ROUTES.home)
    }
  }

  const onGoogleLogin = () => {
    void session.handleGoogleLogin()
  }

  /** Mesmo raciocínio de `onAuthSubmit`: `session.handleOAuthComplete` já faz o hardNavigate no sucesso. */
  const onOAuthComplete = async (tokens: { accessToken: string; refreshToken: string; expiresAt?: number }) => {
    return session.handleOAuthComplete(tokens)
  }

  const onOAuthError = (message: string) => {
    session.setAuthError(message)
    navigate(ROUTES.login)
  }

  // ------------------------------------------------------------------
  // Onboarding de lojista
  // ------------------------------------------------------------------

  /**
   * "Vender no Primeiro Aqui": promove BUYER→STORE_OWNER no servidor (rota
   * idempotente, sem input — o papel nunca sai do cliente) e abre o cadastro
   * do negócio.
   */
  const handleBecomeStoreOwner = async () => {
    try {
      const { user } = await api.becomeStoreOwner()
      session.setAuthUser({ id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl })
      session.setUserRole(user.role)
      admin.setIsSetupOpen(true)
    } catch (err) {
      catalog.addNotification(
        'Cadastro de lojista',
        apiErrorMessage(err, 'Não foi possível iniciar seu cadastro de lojista. Tente novamente.'),
        'warning',
        ROUTES.profile,
      )
    }
  }

  /**
   * Cadastro do negócio ligado ao POST /api/stores real. Decisões:
   * - `categoria` do modal (um valor de `StoreCategory`, ver
   *   src/lib/storeCategory.ts) vai como `category` da loja;
   * - endereço/telefone do modal ficam só no perfil local (businessProfile)
   *   até o backend ter esses campos;
   * - lat/lng vão como 0 por ora (geolocalização é outra fase);
   * - slug derivado do nome; colisão (409) tenta uma vez com sufixo único.
   */
  const handleBusinessSetupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = admin.setupForm.name.trim()
    if (!name) return

    const baseSlug = toCategorySlug(name) || 'minha-loja'
    const create = (slug: string) =>
      api.createStore({
        name,
        slug,
        latitude: 0,
        longitude: 0,
        category: admin.setupForm.category || undefined,
      })

    try {
      let created
      try {
        created = await create(baseSlug)
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          created = await create(`${baseSlug}-${Date.now().toString(36)}`)
        } else {
          throw err
        }
      }
      admin.setBusinessProfile({ ...admin.setupForm, name: created.store.name })
      admin.setIsSetupOpen(false)
      catalog.addNotification(
        'Loja criada',
        `${created.store.name} já está no Primeiro Aqui. Publique seus produtos!`,
        'success',
        ROUTES.myStore,
      )
      navigate(ROUTES.myStore)
    } catch (err) {
      catalog.addNotification(
        'Cadastro do negócio',
        apiErrorMessage(err, 'Não foi possível criar sua loja. Tente novamente.'),
        'warning',
      )
    }
  }

  const handleRepeatOrder = (order: Order) => {
    const result = repeatOrder(order, remoteCatalog.products)
    if (!result.ok) {
      setRepeatError(result.message)
      return
    }

    setRepeatError('')
    cartCheckout.dispatchCart(replaceCart(result.items))
    cartCheckout.setCheckoutStep('cart')
    cartCheckout.setIsCartOpen(true)
    pushToast('Itens do pedido adicionados ao carrinho', 'success')
  }

  /** Fecha o loop do checkout: limpa carrinho/gaveta/cupom e vai para Meus pedidos. Comum aos dois desfechos (com e sem etapa de pagamento). */
  const closeCheckoutDrawer = () => {
    cartCheckout.dispatchCart(clearCart())
    cartCheckout.setCheckoutStep('cart')
    cartCheckout.setDeliveryForm(EMPTY_DELIVERY)
    cartCheckout.handleRemoveCoupon()
    cartCheckout.setIsCartOpen(false)
    setOrdersReloadKey((key) => key + 1)
    navigate(ROUTES.orders)
  }

  /**
   * Checkout real: POST /api/orders com os itens do carrinho e o endereço
   * salvo escolhido. O backend valida estoque e preço; os erros discriminados
   * (409 estoque, 404 produto) viram mensagens específicas aqui.
   */
  const handleFinalizePurchase = async () => {
    if (cartCheckout.cartItemsCount === 0 || isConfirmingOrder) return // trava duplo clique

    if (!cartCheckout.deliveryForm.name) {
      cartCheckout.setCheckoutError('Informe o nome de quem recebe a entrega.')
      return
    }
    // O CEP digitado é só informativo (o endereço real vai por addressId),
    // mas CEP visivelmente errado ainda merece correção antes do pedido.
    if (cartCheckout.deliveryForm.cep && !isValidCep(cartCheckout.deliveryForm.cep)) {
      cartCheckout.setCheckoutError(CEP_ERROR_MESSAGE)
      return
    }
    const addressId = addresses.selectedAddressId || addresses.defaultAddress?.id
    if (!addressId) {
      cartCheckout.setCheckoutError('Cadastre e selecione um endereço de entrega para finalizar.')
      return
    }

    cartCheckout.setCheckoutError('')
    setIsConfirmingOrder(true)
    try {
      const { orders } = await api.createOrder({
        items: cartCheckout.cartState.items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        addressId,
      })

      const titleById = new Map(
        remoteCatalog.products.map((product) => [product.id, product.title]),
      )
      setMyOrders((prev) => [
        ...orders.map((order) => toViewOrder(order, titleById, storeNameById)),
        ...prev,
      ])

      // Feature flag por ambiente (2026-08-07): producao nao tera as chaves
      // do Pagar.me configuradas ate o go-live de pagamento (dinheiro real)
      // ser decidido pelo usuario. `payment.paymentsEnabled` vem de GET
      // /api/payments/config, consultado no mount (ver
      // usePaymentCheckoutState.ts) — chega bem antes do checkout terminar
      // na pratica, mas se ainda estiver `null` (indefinido) tratamos como
      // desligado: falha fechado, nunca abre uma etapa de pagamento capaz
      // de quebrar por falta de publicKey.
      if (payment.paymentsEnabled) {
        // O pedido existe (PENDING de pagamento) — a partir daqui o
        // carrinho NAO e limpo nem a gaveta fechada ainda: a etapa de
        // pagamento (Fase 2) cobre cada order (um por loja) antes de dar o
        // checkout por concluido. Ver finishCheckoutAfterPayment, chamado
        // quando o ultimo pagamento termina (onPaymentContinue).
        payment.startPayment(orders)
        cartCheckout.setCheckoutStep('payment')
      } else {
        // Comportamento PRE-FASE 2: sem chaves no ambiente, o pedido fica
        // PENDING de pagamento (paymentStatus NONE, sem tentativa) e o
        // checkout encerra na hora — igual ao fluxo anterior a esta feature.
        catalog.addNotification(
          'Compra confirmada',
          orders.length > 1
            ? `Seus ${orders.length} pedidos foram confirmados (um por loja).`
            : 'Pedido confirmado! Acompanhe em Meus pedidos.',
          'success',
          ROUTES.orders,
        )
        closeCheckoutDrawer()
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Estoque acabou entre o carrinho e o checkout: recarrega o catálogo
        // para os cards refletirem o estoque real.
        remoteCatalog.retry()
        cartCheckout.setCheckoutError(
          'Um ou mais itens do carrinho ficaram sem estoque. Ajuste as quantidades e tente de novo.',
        )
        return
      }
      if (err instanceof ApiError && err.status === 404) {
        cartCheckout.setCheckoutError(
          'Um dos produtos do carrinho saiu do catálogo. Remova-o para continuar.',
        )
        return
      }
      cartCheckout.setCheckoutError(
        apiErrorMessage(err, 'Não foi possível finalizar a compra. Verifique sua conexão e tente novamente.'),
      )
    } finally {
      setIsConfirmingOrder(false)
    }
  }

  /** Roda quando o ÚLTIMO pedido pendente termina de ser pago: fecha o loop do checkout. */
  const finishCheckoutAfterPayment = () => {
    catalog.addNotification(
      'Compra confirmada',
      payment.totalPayments > 1
        ? `Seus ${payment.totalPayments} pedidos foram pagos (um por loja).`
        : 'Pagamento confirmado! Acompanhe em Meus pedidos.',
      'success',
      ROUTES.orders,
    )
    pushToast('Pagamento confirmado!', 'success')
    payment.resetPayment()
    closeCheckoutDrawer()
  }

  /** Confirma o pagamento do pedido atual (cartão tokenizado no navegador ou Pix). */
  const handlePaymentSubmit = async () => {
    const buyerName = session.authUser?.name ?? cartCheckout.deliveryForm.name
    const buyerEmail = session.authUser?.email ?? ''
    if (cartCheckout.deliveryForm.payment === 'Cartão') {
      await payment.payWithCard(buyerName, buyerEmail)
    } else {
      await payment.payWithPix(buyerName, buyerEmail)
    }
  }

  /** Após um pagamento aprovado: paga o próximo pedido pendente (multi-loja) ou fecha o checkout. */
  const handlePaymentContinue = () => {
    const hasNext = payment.advanceToNextPayment()
    if (!hasNext) finishCheckoutAfterPayment()
  }

  return {
    // sessão / autenticação
    authUser: session.authUser,
    onAuthUserChange: session.setAuthUser,
    userRole: session.userRole,
    isDevMode: session.isDevMode,
    authMode: session.authMode,
    onAuthModeChange: session.setAuthMode,
    authForm: session.authForm,
    onAuthFormChange: (patch: Partial<AuthForm>) => session.setAuthForm((prev) => ({ ...prev, ...patch })),
    authError: session.authError,
    authPending: session.authPending,
    onAuthSubmit,
    onQuickLogin,
    onGoogleLogin,
    onRequireLogin: session.recordReturnTo,
    loginContextMessage: session.resetSuccessMessage || pendingIntentMessage(session.pendingIntent),
    onLogout: handleLogout,
    onBecomeStoreOwner: () => {
      void handleBecomeStoreOwner()
    },
    forgotPasswordOpen: session.forgotPasswordOpen,
    forgotEmail: session.forgotEmail,
    onForgotEmailChange: session.setForgotEmail,
    forgotStatus: session.forgotStatus,
    forgotError: session.forgotError,
    onOpenForgotPassword: session.openForgotPassword,
    onCloseForgotPassword: session.closeForgotPassword,
    onForgotPasswordSubmit: (event: React.FormEvent<HTMLFormElement>) => {
      void session.handleForgotPasswordSubmit(event)
    },
    onPasswordResetSuccess: session.notePasswordResetSuccess,
    onOAuthComplete,
    onOAuthError,

    // vitrine / busca — catálogo real
    products: remoteCatalog.products,
    productsLoading: remoteCatalog.isLoading,
    productsError: remoteCatalog.error,
    onRetryProducts: remoteCatalog.retry,
    categories: remoteCatalog.categories,
    searchQuery: catalog.searchQuery,
    onSearchChange: catalog.setSearchQuery,
    searchInputRef: catalog.searchInputRef,
    favorites: catalog.favorites,
    onToggleFavorite: guardedToggleFavorite,
    onAddToCart: cartCheckout.handleAddToCart,
    onBuyNow: guardedBuyNow,
    cartCount: cartCheckout.cartItemsCount,
    notifications: catalog.notifications,
    notificationCount: catalog.unreadCount,
    onNotificationsOpen: catalog.markNotificationsRead,
    onOpenCart: () => cartCheckout.setIsCartOpen(true),

    // pedidos reais da pessoa
    orders: ordersForView,
    ordersLoading,
    ordersError,
    onRetryOrders: () => setOrdersReloadKey((key) => key + 1),
    onRepeatOrder: handleRepeatOrder,
    repeatError,

    // rastreio e perfil do negócio (o painel admin real vive em useAdminDashboard)
    currentOrder: admin.currentOrder,
    businessProfile: admin.businessProfile,

    // cadastro do negócio
    isSetupOpen: admin.isSetupOpen,
    setupForm: admin.setupForm,
    onSetupFormChange: admin.onSetupFormChange,
    onBusinessSetupSubmit: (event: React.FormEvent<HTMLFormElement>) => {
      void handleBusinessSetupSubmit(event)
    },
    onSetupClose: admin.onSetupClose,

    // carrinho e checkout
    isCartOpen: cartCheckout.isCartOpen,
    checkoutStep: cartCheckout.checkoutStep,
    cartState: cartCheckout.cartState,
    deliveryForm: cartCheckout.deliveryForm,
    checkoutError: cartCheckout.checkoutError,
    couponCode: cartCheckout.couponCode,
    couponError: cartCheckout.couponError,
    discount: cartCheckout.discount,
    onCartClose: () => {
      cartCheckout.setIsCartOpen(false)
      cartCheckout.setCheckoutStep('cart')
      // Fechar no meio da etapa de pagamento não deve deixar cardForm/CPF ou
      // pedidos pendentes "vazando" pro próximo checkout — os pedidos já
      // criados continuam PENDING no backend, retomáveis por Meus pedidos.
      if (payment.pendingOrders.length > 0) payment.resetPayment()
    },
    onCartIncrement: cartCheckout.onIncrement,
    onCartDecrement: cartCheckout.onDecrement,
    onCartRemove: cartCheckout.onRemove,
    onDeliveryChange: cartCheckout.onDeliveryChange,
    onCouponCodeChange: cartCheckout.setCouponCode,
    onApplyCoupon: cartCheckout.handleApplyCoupon,
    onRemoveCoupon: cartCheckout.handleRemoveCoupon,
    onCartContinue: guardedCartContinue,
    onCartConfirm: () => {
      void handleFinalizePurchase()
    },
    isConfirmingOrder,

    // etapa de pagamento (Fase 2)
    paymentOrder: payment.currentOrder,
    paymentIndex: payment.paymentIndex,
    totalPayments: payment.totalPayments,
    paymentCardForm: payment.cardForm,
    paymentCustomerForm: payment.customerForm,
    paymentFieldErrors: payment.fieldErrors,
    paymentStatus: payment.status,
    paymentErrorMessage: payment.errorMessage,
    pixData: payment.pixData,
    pixPaymentStatus: payment.pixPaymentStatus,
    paymentPublicKey: payment.publicKey,
    paymentConfigError: payment.configError,
    onPaymentCardFormChange: payment.onCardFormChange,
    onPaymentCustomerFormChange: payment.onCustomerFormChange,
    onPaymentSubmit: () => {
      void handlePaymentSubmit()
    },
    onPaymentContinue: handlePaymentContinue,

    // endereços reais
    addresses: addresses.addresses,
    addressesLoading: addresses.isLoading,
    addressesError: addresses.loadError,
    onRetryAddresses: addresses.retry,
    addressLine: addresses.defaultAddress ? formatAddress(addresses.defaultAddress) : '',
    addressForm: addresses.addressForm,
    addressError: addresses.addressError,
    onAddressFormChange: addresses.onAddressFormChange,
    onAddressSubmit: (event: React.FormEvent<HTMLFormElement>) => {
      void addresses.onAddressSubmit(event)
    },
    addressSubmitting: addresses.isSubmitting,
    cepLookupPending: addresses.isCepLookupPending,
    cepNotFound: addresses.isCepNotFound,
    selectedAddressId: addresses.selectedAddressId,
    onSelectAddress: handleSelectAddress,
  }
}
