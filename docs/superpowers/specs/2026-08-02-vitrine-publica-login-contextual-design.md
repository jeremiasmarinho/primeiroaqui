# Vitrine pública com login contextual

- **Data:** 2026-08-02
- **Status:** Aprovado, pronto para plano de implementação

## Problema

Hoje `isProtected()` (`src/router/routes.ts`) bloqueia toda rota exceto `/entrar`:
qualquer visita à vitrine, a um produto ou a uma loja força login antes de
qualquer coisa. Isso já estava sinalizado como decisão de produto pendente no
próprio código (comentário "NOTA DE PRODUTO" em `routes.ts`).

Decisão do responsável pelo produto: **a tela de login/cadastro só deve
aparecer em dois gatilhos** — (1) quando o cliente for pagar (avançar do
carrinho para a etapa de entrega), e (2) quando o cliente clicar
explicitamente em "entrar"/"logar". Navegar pela vitrine, ver produto, ver
loja, favoritar (ver exceção abaixo) e adicionar ao carrinho deve funcionar
sem conta.

## 1. Rotas públicas vs. protegidas

Inverter a lista: em vez de listar o que é público (cresce a cada rota nova),
listar o que **continua protegido** — é o conjunto menor e mais estável agora.

```ts
// src/router/routes.ts
export const PROTECTED_PATTERNS = [
  '/perfil',
  '/pedidos',
  '/pedido',
  '/enderecos',
  '/favoritos',
  '/admin',
] as const

export const isProtected = (path: string): boolean =>
  PROTECTED_PATTERNS.some((pattern) => path === pattern || path.startsWith(`${pattern}/`))
```

**Público:** `/`, `/busca`, `/categorias`, `/categoria/:slug`, `/produto/:id`,
`/loja/:slug`, `/entrar`.

**Continua protegido:** `/perfil`, `/pedidos`, `/pedido/:id`, `/enderecos`,
`/favoritos`, `/admin/*`.

`/favoritos` fica protegido mesmo sendo uma tela de "visualizar", porque com a
regra da seção 2 (favoritar sempre exige login) ela nunca teria conteúdo para
um visitante — abri-la pública só mostraria um estado vazio permanente.

O guard em `AppRouter.tsx` continua igual na forma (`if (!authUser &&
isProtected(location)) return <Redirect .../>`), mas passa a também gravar o
destino de retorno (seção 2) antes de redirecionar.

## 2. Gatilhos contextuais e retomada pós-login

Dois pontos de código hoje mutam estado direto, sem checar sessão:

- `toggleFavorite` (`useCatalogState.ts`) — favoritar.
- `handleCartContinue` (`useMarketplaceState.ts`) e `handleBuyNow`
  (`useCartCheckoutState.ts`) — avançar do carrinho para a etapa de entrega.

### Intenção pendente

Um único conceito cobre os três gatilhos (favoritar, checkout, rota
protegida): guardar **para onde voltar** e **o que terminar**, em estado React
simples (sem storage — a navegação para `/entrar` é client-side via wouter,
o estado do componente sobrevive).

```ts
// src/router/routes.ts (ou novo src/state/pendingIntent.ts)
export type PendingIntent =
  | { type: 'favorite'; productId: number }
  | { type: 'resume-checkout' }
```

Novo estado em `useSessionState`:

```ts
const [pendingReturnTo, setPendingReturnTo] = useState<string | null>(null)
const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(null)

const redirectToLogin = (currentPath: string, intent?: PendingIntent) => {
  setPendingReturnTo(currentPath)
  setPendingIntent(intent ?? null)
  navigate(ROUTES.login)
}
```

### Os três gatilhos usando `redirectToLogin`

1. **Guarda de rota protegida** (`AppRouter.tsx`): ao redirecionar por
   `isProtected`, chama `session.redirectToLogin(location)` (sem intent) em
   vez de `<Redirect>` direto — assim ele também lembra de onde veio.
2. **Favoritar como visitante** (wrapper em `useMarketplaceState`):
   ```ts
   const guardedToggleFavorite = (product: Product) => {
     if (!session.authUser) {
       session.redirectToLogin(location, { type: 'favorite', productId: product.id })
       return
     }
     catalog.toggleFavorite(product)
   }
   ```
3. **Continuar/Comprar agora como visitante**:
   ```ts
   const guardedCartContinue = () => {
     if (cartCheckout.cartItemsCount === 0) return
     if (!session.authUser) {
       session.redirectToLogin(location, { type: 'resume-checkout' })
       return
     }
     handleCartContinue()
   }

   const guardedBuyNow = (product: Product) => {
     if (!session.authUser) {
       cartCheckout.handleAddToCart(product) // seguro como visitante
       session.redirectToLogin(location, { type: 'resume-checkout' })
       return
     }
     cartCheckout.handleBuyNow(product)
   }
   ```
   `handleAddToCart` roda antes do redirect porque adicionar ao carrinho é
   uma ação segura para visitante — só a transição para a etapa de entrega
   (que hoje pressupõe pessoa identificada para endereço/pagamento) exige
   sessão.

### Resolvendo a intenção após login

`handleAuthSubmit` e `handleQuickLogin` (`useSessionState.ts`) hoje terminam
com `navigate(ROUTES.home)` fixo. Passam a chamar um callback `onSuccess`
fornecido por `useMarketplaceState`, que resolve a intenção pendente:

```ts
const handleAfterLogin = () => {
  if (session.pendingIntent?.type === 'favorite') {
    const product = products.find((p) => p.id === session.pendingIntent.productId)
    if (product) catalog.toggleFavorite(product)
  } else if (session.pendingIntent?.type === 'resume-checkout') {
    handleCartContinue() // reaproveita o preenchimento de endereço padrão
    cartCheckout.setIsCartOpen(true)
  }
  navigate(session.pendingReturnTo ?? ROUTES.home)
  session.setPendingReturnTo(null)
  session.setPendingIntent(null)
}
```

`handleQuickLogin` (atalhos de desenvolvimento) chama o mesmo callback, para
os testes e o uso em dev se comportarem igual ao fluxo real.

### Degradação caso a pessoa dê reload em `/entrar`

Como `pendingIntent`/`pendingReturnTo` vivem em memória (não em storage), um
reload manual da página de login perde essa informação — a pessoa loga e cai
na home em vez de retomar de onde saiu. Aceitável: não é perda de dado (o
carrinho em si sobrevive ao reload — seção 3), só perde a conveniência de
retomar automaticamente. Favoritar de novo ou clicar em "Continuar" de novo
resolve. Não precisa de storage para cobrir esse caso.

## 3. Carrinho de visitante precisa sobreviver a reload

Achado ao ler o código atual: a persistência do carrinho hoje é condicional à
sessão —

```ts
// useMarketplaceState.ts, estado atual
useEffect(() => {
  writeStoredJSON(STORAGE_KEYS.cart, session.authUser ? cartCheckout.cartState : null)
}, [session.authUser, cartCheckout.cartState])
```

Sem sessão, o carrinho nunca é gravado — um reload ou fechar a aba apaga o
carrinho do visitante, contradizendo o requisito de "funcionar como
visitante". Passa a gravar sempre:

```ts
useEffect(() => {
  writeStoredJSON(STORAGE_KEYS.cart, cartCheckout.cartState)
}, [cartCheckout.cartState])
```

O logout continua limpando o carrinho (`dispatchCart(clearCart())` em
`handleLogout`, sem mudança) — mantém a mesma garantia de privacidade em
dispositivo compartilhado que já existia.

Favoritos **não** precisam do mesmo tratamento: como favoritar sempre exige
login (seção 2), não existe "favorito de visitante" para persistir.

## 4. Ponto de entrada visível para "entrar"

Hoje o avatar no `TopBar` e o item "Mais" do `BottomNav` sempre apontam para
`/perfil` (ou `/admin` para operação), mostrando iniciais. Sem sessão, isso
levaria a um redirecionamento imediato e sem explicação visual — funciona,
mas é confuso.

Ajuste pequeno: quando `!authUser`, o mesmo botão aponta direto para
`ROUTES.login` e troca as iniciais por um rótulo "Entrar" (ícone de
pessoa/login em vez do círculo de iniciais). Mesmo destino final de qualquer
forma (o guard de rota já levaria para lá), só fica mais direto e honesto.

## 5. Mensagem de contexto na tela de login

`LoginScreen` recebe um novo prop opcional, derivado de `pendingIntent`, para
explicar por que a pessoa foi enviada para lá:

- `favorite` → "Faça login para favoritar este produto."
- `resume-checkout` → "Faça login para continuar sua compra."
- sem intenção (clicou em "Entrar" ou caiu numa rota protegida sem gatilho
  específico) → sem mensagem extra, comportamento atual.

## Fora de escopo

- Migrar favoritos de visitante para a conta no momento do login (não existe
  "favorito de visitante" neste desenho — favoritar sempre exige sessão).
- Qualquer mudança em `/perfil`, `/pedidos`, `/pedido/:id`, `/enderecos`,
  `/admin` — continuam exatamente como hoje (protegidos).
- Persistência de carrinho entre dispositivos ou contas (continua sendo por
  navegador, via `localStorage`).

## Impacto em teste

- `src/test/routing.test.tsx`: os casos que hoje afirmam "sem sessão, a
  vitrine/produto/loja levam para login" invertem — passam a afirmar que
  essas rotas **não** redirecionam. `/perfil`, `/pedido/:id`, `/admin`
  continuam com o teste de redirecionamento.
- Novos casos: favoritar como visitante redireciona com o produto certo
  guardado; login aplica o favorito e retorna à página de origem; "Continuar"
  e "Comprar agora" como visitante redirecionam e, após login, retomam a
  etapa de entrega com o carrinho intacto; clique no avatar/"Mais" sem sessão
  vai direto para `/entrar`.
- `src/test/persistence.test.tsx`: adicionar caso de carrinho de visitante
  sobrevivendo a reload sem sessão.
- E2E (`e2e/auth.spec.js`, `e2e/purchase.spec.js`, `e2e/navigation.spec.js`):
  os fluxos que hoje fazem login antes de qualquer interação precisam de um
  cenário novo de compra como visitante com login no meio do checkout.
