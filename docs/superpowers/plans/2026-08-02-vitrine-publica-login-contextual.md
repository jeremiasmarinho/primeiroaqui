# Vitrine Pública com Login Contextual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir a vitrine, produto, loja, categorias e busca ao público sem login, e mostrar a tela de login/cadastro só em dois gatilhos contextuais (favoritar, avançar para pagamento) ou quando a pessoa clica explicitamente em "Entrar" — retomando a ação automaticamente após o login.

**Architecture:** Inverter `isProtected()` de bloqueio-total para uma lista explícita de rotas protegidas (perfil, pedidos, endereços, favoritos, admin). Um novo conceito de `PendingIntent` (favoritar | retomar checkout) guardado em estado React (não storage) registra para onde voltar e o que terminar antes de mandar para `/entrar`; após login bem-sucedido, `useMarketplaceState` resolve essa intenção e navega de volta.

**Tech Stack:** React 19, TypeScript strict, wouter (roteamento), Vitest + Testing Library, Playwright.

## Global Constraints

- Spec aprovada: `docs/superpowers/specs/2026-08-02-vitrine-publica-login-contextual-design.md` — toda decisão de escopo remete a ela.
- TDD: escrever o teste que falha, confirmar a falha, implementar o mínimo, confirmar que passa, commitar.
- Zero `any`. TypeScript `strict` já ligado — `npm run typecheck` deve continuar em zero erros a cada task.
- `npm run lint` deve continuar em zero erros a cada task.
- Nenhum arquivo `.tsx`/`.ts` de produção deve passar de 300 linhas (limite do projeto). Nenhum dos arquivos tocados aqui chega perto disso.
- Favoritos **não** têm modo visitante — favoritar sempre exige login (decisão do spec, seção 1/2). Só o carrinho persiste para visitante.
- `/perfil`, `/pedidos`, `/pedido/:id`, `/enderecos`, `/favoritos`, `/admin/*` continuam protegidos, sem mudança de comportamento.
- Rodar `npx vitest run` (suíte inteira) ao final de cada task — não só o arquivo tocado — porque mudanças de roteamento têm efeito colateral em testes de outros arquivos (ver Task 6).

---

## Task 1: `PendingIntent` — tipo e mensagem de contexto

**Files:**
- Create: `src/state/pendingIntent.ts`
- Test: `src/state/pendingIntent.test.ts`

**Interfaces:**
- Produces: `PendingIntent` (tipo), `pendingIntentMessage(intent: PendingIntent | null): string` — consumidos pela Task 4 (`useSessionState.ts`, `useMarketplaceState.ts`).

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/state/pendingIntent.test.ts
import { describe, expect, it } from 'vitest'
import { pendingIntentMessage } from './pendingIntent'
import type { PendingIntent } from './pendingIntent'

describe('pendingIntentMessage', () => {
  it('sem intencao, nao ha mensagem', () => {
    expect(pendingIntentMessage(null)).toBe('')
  })

  it('favoritar explica o motivo do redirecionamento', () => {
    const intent: PendingIntent = { type: 'favorite', productId: 7 }
    expect(pendingIntentMessage(intent)).toMatch(/favoritar/i)
  })

  it('retomar checkout explica o motivo do redirecionamento', () => {
    const intent: PendingIntent = { type: 'resume-checkout' }
    expect(pendingIntentMessage(intent)).toMatch(/continuar sua compra/i)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/state/pendingIntent.test.ts`
Expected: FAIL — `Failed to resolve import "./pendingIntent"` (o módulo não existe ainda).

- [ ] **Step 3: Implementar**

```ts
// src/state/pendingIntent.ts
/**
 * Intenção pendente de retomada pós-login.
 *
 * Guardada em estado React (não em storage) por `useSessionState` — a
 * navegação para `/entrar` é client-side via wouter, então o estado do
 * componente sobrevive à transição. Um reload manual em `/entrar` perde essa
 * informação (degradação aceitável: o carrinho em si persiste — ver Task 5 —,
 * só a conveniência de retomar automaticamente se perde).
 */
export type PendingIntent =
  | { type: 'favorite'; productId: number }
  | { type: 'resume-checkout' }

/** Mensagem de contexto exibida na tela de login, conforme o gatilho. */
export const pendingIntentMessage = (intent: PendingIntent | null): string => {
  if (!intent) return ''
  if (intent.type === 'favorite') return 'Faça login para favoritar este produto.'
  return 'Faça login para continuar sua compra.'
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/state/pendingIntent.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/state/pendingIntent.ts src/state/pendingIntent.test.ts
git commit -m "feat: adiciona tipo PendingIntent e mensagem de contexto do login"
```

---

## Task 2: Vitrine, produto, loja, categoria e busca ficam públicos

**Files:**
- Modify: `src/router/routes.ts`
- Modify: `src/test/routing.test.tsx`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `PROTECTED_PATTERNS: readonly string[]`, `isProtected(path: string): boolean` com semântica invertida (era bloqueio-total, agora lista explícita) — consumido por `AppRouter.tsx` (já existente, sem mudança de assinatura).

- [ ] **Step 1: Escrever os testes que falham (inverter 2 casos existentes, adicionar 1)**

Em `src/test/routing.test.tsx`, dentro do `describe('sessao', ...)`, substituir os dois casos abaixo (o terceiro, sobre `/perfil`, fica igual — não mexer nele):

```ts
    it('sem sessao, a vitrine tambem leva para /entrar', () => {
      // Comportamento preservado da versao anterior. Abrir a vitrine ao
      // publico e decisao de produto — ver nota em src/router/routes.ts.
      goTo(ROUTES.home)
      render(<MarketplaceApp />)

      expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    })

    it('deep link em rota protegida volta para o login, sem crash', () => {
      goTo(ROUTES.product(1))
      render(<MarketplaceApp />)

      expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    })
```

vira:

```ts
    it('sem sessao, a vitrine e publica — nao redireciona para login', () => {
      goTo(ROUTES.home)
      render(<MarketplaceApp />)

      expect(screen.getByRole('navigation', { name: /navegação principal/i })).toBeInTheDocument()
      expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument()
    })

    it('produto continua acessivel sem sessao — rota publica', () => {
      goTo(ROUTES.product(1))
      render(<MarketplaceApp />)

      expect(screen.getByRole('heading', { name: /ventilador de mesa premium/i })).toBeInTheDocument()
      expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument()
    })

    it('favoritos continua protegido sem sessao', () => {
      goTo(ROUTES.favorites)
      render(<MarketplaceApp />)

      expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    })
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/test/routing.test.tsx`
Expected: FAIL — os dois primeiros novos casos falham (`isProtected` ainda bloqueia tudo, então a vitrine e o produto ainda mostram a tela de login em vez do conteúdo esperado).

- [ ] **Step 3: Inverter `isProtected` em `routes.ts`**

Em `src/router/routes.ts`, substituir:

```ts
/**
 * Rotas públicas. Hoje só o login — todo o resto exige sessão.
 *
 * NOTA DE PRODUTO: o README define que "a vitrine deve ser a página inicial
 * para reduzir atrito de conversão", o que pediria `/`, `/produto/:id` e
 * `/loja/:slug` públicos. Abrir a vitrine é decisão de produto, não de
 * roteamento, então esta WU preserva o comportamento atual. Quando for aberta,
 * basta acrescentar os padrões aqui — o teste `routing.test.tsx` cobre os dois
 * lados da regra.
 */
export const PUBLIC_PATTERNS = ['/entrar'] as const

export const isProtected = (path: string): boolean =>
  !PUBLIC_PATTERNS.some((pattern) => path === pattern || path.startsWith(`${pattern}/`))
```

por:

```ts
/**
 * Rotas protegidas — exigem sessão. Tudo que não está aqui é público
 * (vitrine, produto, loja, categoria, busca, categorias, login).
 *
 * Decisão de produto (2026-08-02, ver docs/superpowers/specs/2026-08-02-
 * vitrine-publica-login-contextual-design.md): navegar, ver produto/loja e
 * adicionar ao carrinho não exige mais conta. Login só aparece ao favoritar,
 * ao avançar para pagamento, ou ao clicar explicitamente em "Entrar".
 *
 * `/favoritos` fica protegido mesmo sendo uma tela de "visualizar": como
 * favoritar sempre exige login, a tela nunca teria conteúdo para visitante.
 */
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

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/test/routing.test.tsx`
Expected: PASS (todos os casos, incluindo os 3 novos/invertidos).

- [ ] **Step 5: Rodar a suíte inteira para checar efeito colateral**

Run: `npx vitest run`
Expected: FAIL em vários outros arquivos — é esperado e coberto pela Task 6. Anotar mentalmente que este passo é só um checkpoint informativo, não bloqueia o commit desta task (a Task 2 em si está completa e correta).

- [ ] **Step 6: Commit**

```bash
git add src/router/routes.ts src/test/routing.test.tsx
git commit -m "feat: inverte isProtected — vitrine, produto, loja e busca ficam publicos"
```

---

## Task 3: Ponto de entrada visível "Entrar" para visitante

**Files:**
- Modify: `src/components/TopBar.tsx`
- Modify: `src/components/BottomNav.tsx`
- Modify: `src/screens/HomeScreen.tsx`
- Modify: `src/router/AppRouter.tsx`
- Modify: `src/components/components.test.tsx`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `TopBarProps.isAuthenticated?: boolean` (default `true`), `BottomNavProps.isAuthenticated?: boolean` (default `true`), `HomeScreenProps.isAuthenticated: boolean` — consumidos pela Task 4 (nenhuma mudança de assinatura adicional necessária lá) e pela Task 6 (testes que clicam no link "Entrar").

- [ ] **Step 1: Escrever os testes que falham**

Em `src/components/components.test.tsx`, dentro do `describe('TopBar', ...)`, adicionar:

```ts
  it('sem sessao, o avatar vira ponto de entrada para login', () => {
    render(<TopBar {...baseProps} isAuthenticated={false} />)
    const entrar = screen.getByRole('link', { name: /entrar ou criar conta/i })
    expect(entrar).toHaveAttribute('href', '/perfil') // profileHref por padrao; AppRouter passa /entrar quando visitante
  })
```

Dentro do `describe('BottomNav', ...)`, adicionar:

```ts
  it('sem sessao, o item "Mais" vira "Entrar" e aponta para /entrar', () => {
    render(<BottomNav isAuthenticated={false} />)
    const entrar = screen.getByRole('link', { name: 'Entrar' })
    expect(entrar).toHaveAttribute('href', '/entrar')
    expect(screen.queryByRole('link', { name: 'Mais' })).not.toBeInTheDocument()
  })

  it('autenticado (padrao), o item continua "Mais"', () => {
    render(<BottomNav moreHref="/perfil" />)
    expect(screen.getByRole('link', { name: 'Mais' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/components/components.test.tsx`
Expected: FAIL — `isAuthenticated` não existe em `TopBarProps`/`BottomNavProps`, o link "Entrar" não existe.

- [ ] **Step 3: Implementar em `TopBar.tsx`**

Adicionar `LogIn` ao import de ícones (linha 3 atual: `import { Bell, Camera, ChevronRight, MapPin, Search } from 'lucide-react'`) →

```ts
import { Bell, Camera, ChevronRight, LogIn, MapPin, Search } from 'lucide-react'
```

Na interface `TopBarProps`, adicionar campo:

```ts
  /** Guest (sem sessão) mostra ícone de entrada em vez de iniciais. */
  isAuthenticated?: boolean
```

Na assinatura da função, adicionar com default:

```ts
  isAuthenticated = true,
```

No bloco do avatar, substituir:

```tsx
          <Link
            href={profileHref ?? ROUTES.profile}
            aria-label={`Abrir perfil de ${userName || 'convidado'}`}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface
                       text-sm font-extrabold text-ink shadow-card"
          >
            {userInitials}
          </Link>
```

por:

```tsx
          <Link
            href={profileHref ?? ROUTES.profile}
            aria-label={isAuthenticated ? `Abrir perfil de ${userName || 'convidado'}` : 'Entrar ou criar conta'}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface
                       text-sm font-extrabold text-ink shadow-card"
          >
            {isAuthenticated ? userInitials : <LogIn className="h-5 w-5" aria-hidden="true" />}
          </Link>
```

- [ ] **Step 4: Implementar em `BottomNav.tsx`**

Adicionar `LogIn` ao import (linha 1 atual: `import { Heart, Home, LayoutGrid, Menu, ShoppingCart } from 'lucide-react'`) →

```ts
import { Heart, Home, LayoutGrid, LogIn, Menu, ShoppingCart } from 'lucide-react'
```

Na interface `BottomNavProps`, adicionar:

```ts
  /** Guest (sem sessão): item "Mais" vira "Entrar" e aponta para /entrar. */
  isAuthenticated?: boolean
```

Na assinatura, adicionar com default:

```ts
  isAuthenticated = true,
```

No array `items`, substituir a última entrada:

```ts
    { id: 'more', label: 'Mais', Icon: Menu, href: moreHref },
```

por:

```ts
    isAuthenticated
      ? { id: 'more', label: 'Mais', Icon: Menu, href: moreHref }
      : { id: 'more', label: 'Entrar', Icon: LogIn, href: ROUTES.login },
```

(a anotação de tipo do array `items` já contextualiza `id` como `NavId` — não
precisa de `as const` aqui, igual aos demais itens do array).

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run src/components/components.test.tsx`
Expected: PASS.

- [ ] **Step 6: Encadear `isAuthenticated` por `HomeScreen.tsx` e `AppRouter.tsx`**

Em `src/screens/HomeScreen.tsx`, na interface `HomeScreenProps`, adicionar (após `moreHref?: string`):

```ts
  isAuthenticated: boolean
```

Na assinatura da função, adicionar `isAuthenticated,` (após `moreHref,`).

No JSX, no `<TopBar ... />`, adicionar `isAuthenticated={isAuthenticated}` (após `profileHref={moreHref}`). No `<BottomNav ... />`, adicionar `isAuthenticated={isAuthenticated}` (após `moreHref={moreHref}`).

Em `src/router/AppRouter.tsx`, dentro de `vitrine()`, no `moreHref` já calculado (`const moreHref = userRole === 'admin' ? ROUTES.admin() : ROUTES.profile`), passar para `<HomeScreen ... />` o novo prop:

```tsx
      isAuthenticated={!!authUser}
```

(inserir logo após `moreHref={moreHref}` na chamada de `<HomeScreen>`).

- [ ] **Step 7: Rodar a suíte inteira**

Run: `npx vitest run`
Expected: as mesmas falhas pré-existentes da Task 2 (ainda não corrigidas, isso é esperado — Task 6 resolve), nenhuma falha NOVA introduzida por esta task.

- [ ] **Step 8: Commit**

```bash
git add src/components/TopBar.tsx src/components/BottomNav.tsx src/screens/HomeScreen.tsx src/router/AppRouter.tsx src/components/components.test.tsx
git commit -m "feat: avatar e item Mais viram ponto de entrada Entrar para visitante"
```

---

## Task 4: Gatilhos contextuais + retomada pós-login

Esta é a task central: favoritar e avançar para pagamento como visitante
redirecionam para `/entrar`; login resolve a intenção e retoma.

**Files:**
- Modify: `src/state/useSessionState.ts`
- Modify: `src/state/useMarketplaceState.ts`
- Modify: `src/router/AppRouterProps.ts`
- Modify: `src/router/AppRouter.tsx`
- Modify: `src/screens/LoginScreen.tsx`
- Create: `src/test/guest-checkout.test.tsx`

**Interfaces:**
- Consumes: `PendingIntent`, `pendingIntentMessage` (Task 1); `isProtected` (Task 2); `isAuthenticated` já roteado por `HomeScreen`/`AppRouter` (Task 3).
- Produces: `AppRouterProps.onRequireLogin: (path: string) => void`, `AppRouterProps.loginContextMessage: string`, `LoginScreenProps.contextMessage: string`. Nenhuma mudança de assinatura em `onAuthSubmit`/`onQuickLogin`/`onToggleFavorite`/`onBuyNow`/`onCartContinue` (continuam com os mesmos tipos externos) — só a implementação por trás muda.

- [ ] **Step 1: Escrever o teste que falha — favoritar como visitante**

```ts
// src/test/guest-checkout.test.tsx
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'
import { ROUTES } from '../router/routes'

const bottomNav = () => screen.getByRole('navigation', { name: /navegação principal/i })

describe('visitante — favoritar', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('favoritar como visitante redireciona para login com mensagem de contexto', () => {
    render(<MarketplaceApp />)
    const heart = screen.getAllByRole('button', { name: /^salvar .+ nos favoritos$/i })[0] as HTMLElement
    fireEvent.click(heart)

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByText(/faça login para favoritar/i)).toBeInTheDocument()
  })

  it('apos logar, o favorito e aplicado e a pessoa volta pra onde estava', () => {
    render(<MarketplaceApp />)
    const heart = screen.getAllByRole('button', { name: /^salvar .+ nos favoritos$/i })[0] as HTMLElement
    const title = heart.getAttribute('aria-label')?.replace(/^Salvar /, '').replace(/ nos favoritos$/, '') ?? ''
    fireEvent.click(heart)

    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))

    expect(window.location.pathname).toBe('/')
    expect(
      screen.getByRole('button', { name: new RegExp(`^remover ${title} dos favoritos$`, 'i') }),
    ).toBeInTheDocument()
  })
})

describe('visitante — checkout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('continuar no carrinho como visitante redireciona para login com mensagem de contexto', () => {
    render(<MarketplaceApp />)
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByText(/faça login para continuar sua compra/i)).toBeInTheDocument()
  })

  it('apos logar, retoma a etapa de entrega com o carrinho intacto', () => {
    render(<MarketplaceApp />)
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))

    expect(screen.getByLabelText('Seu nome')).toBeInTheDocument()
    expect(within(bottomNav()).getByRole('button', { name: /carrinho — 1 itens/i })).toBeInTheDocument()
  })

  it('comprar agora como visitante adiciona ao carrinho e so entao redireciona', () => {
    window.history.pushState({}, '', ROUTES.product(1))
    render(<MarketplaceApp />)
    fireEvent.click(screen.getByRole('button', { name: /comprar agora/i }))

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))

    expect(screen.getByLabelText('Seu nome')).toBeInTheDocument()
    expect(within(bottomNav()).getByRole('button', { name: /carrinho — 1 itens/i })).toBeInTheDocument()
  })
})

describe('visitante — clique explicito em Entrar', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('clicar em Entrar na barra inferior nao mostra mensagem de contexto', () => {
    render(<MarketplaceApp />)
    fireEvent.click(within(bottomNav()).getByRole('link', { name: 'Entrar' }))

    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.queryByText(/faça login para/i)).not.toBeInTheDocument()
  })
})

describe('degradacao aceitavel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('reload em /entrar perde a retomada automatica, mas nao quebra', () => {
    const first = render(<MarketplaceApp />)
    fireEvent.click(screen.getAllByRole('button', { name: /^salvar .+ nos favoritos$/i })[0] as HTMLElement)
    first.unmount()

    render(<MarketplaceApp />)
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))

    expect(window.location.pathname).toBe('/')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/test/guest-checkout.test.tsx`
Expected: FAIL em todos os casos — favoritar/continuar/comprar-agora ainda mutam
direto sem checar sessão, e o link "Entrar" ainda não existe de fato na
barra (fica pendente até a Task 3 estar mesclada — se rodado antes da Task 3
comitada, falha também por falta do link; como as tasks são sequenciais isso
já estará resolvido).

- [ ] **Step 3: Reescrever `useSessionState.ts` por completo**

```ts
// src/state/useSessionState.ts
import { useState } from 'react'

import { ROUTES } from '../router/routes'
import type { AuthForm } from '../screens/LoginScreen'
import { readStoredJSON } from '../lib/storage'
import { STORAGE_KEYS } from './session'
import { EMAIL_REGEX, normalizeStoredUser } from './marketplaceSeed'
import type { PendingIntent } from './pendingIntent'
import type { Role, User } from '../types'

/**
 * Sessão: usuário autenticado, papel, formulário de login/cadastro, e a
 * intenção pendente de retomada (`src/state/pendingIntent.ts`).
 *
 * `handleAuthSubmit`/`handleQuickLogin` não navegam mais sozinhos — devolvem
 * se o login deu certo (ou sempre dão certo, no atalho de dev) e quem chama
 * (`useMarketplaceState`) decide para onde ir, porque só ele sabe resolver a
 * intenção pendente (favoritar, retomar checkout), que mora em outros hooks.
 */
export function useSessionState(navigate: (path: string) => void) {
  const storedUser = normalizeStoredUser(readStoredJSON<unknown>(STORAGE_KEYS.user, null))

  const [userRole, setUserRole] = useState<Role>(() => storedUser?.role ?? 'client')
  const [authUser, setAuthUser] = useState<User | null>(storedUser)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authForm, setAuthForm] = useState<AuthForm>({ email: '', password: '', name: '' })
  const [authError, setAuthError] = useState('')
  const [pendingReturnTo, setPendingReturnTo] = useState<string | null>(null)
  const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(null)

  const isDevMode = import.meta.env.DEV

  /** Guarda de rota protegida: só registra o destino — quem navega é o AppRouter (via <Redirect>). */
  const recordReturnTo = (path: string) => {
    setPendingReturnTo(path)
    setPendingIntent(null)
  }

  /** Gatilho contextual (favoritar, checkout): registra e navega para /entrar. */
  const redirectToLogin = (path: string, intent: PendingIntent | null = null) => {
    setPendingReturnTo(path)
    setPendingIntent(intent)
    navigate(ROUTES.login)
  }

  const clearPendingLogin = () => {
    setPendingReturnTo(null)
    setPendingIntent(null)
  }

  const handleAuthSubmit = (event: React.FormEvent<HTMLFormElement>): boolean => {
    event.preventDefault()

    if (!EMAIL_REGEX.test(authForm.email)) {
      setAuthError('Informe um e-mail valido.')
      return false
    }
    if (authForm.password.length < 6) {
      setAuthError('Senha deve ter ao menos 6 caracteres.')
      return false
    }

    setAuthError('')
    setAuthUser({
      name: authForm.name || 'Cliente Primeiro Aqui',
      email: authForm.email,
      role: 'client',
    })
    setUserRole('client')
    return true
  }

  const handleQuickLogin = (role: Role): void => {
    setUserRole(role)
    setAuthUser({
      name: role === 'admin' ? 'Operador' : 'Cliente',
      email: authForm.email || 'cliente@primeiroaqui.com',
      role,
    })
  }

  return {
    authUser,
    setAuthUser,
    userRole,
    setUserRole,
    authMode,
    setAuthMode,
    authForm,
    setAuthForm,
    authError,
    isDevMode,
    pendingReturnTo,
    pendingIntent,
    recordReturnTo,
    redirectToLogin,
    clearPendingLogin,
    handleAuthSubmit,
    handleQuickLogin,
  }
}
```

- [ ] **Step 4: Atualizar `AppRouterProps.ts`**

Adicionar dois campos à interface (após `onLogout: () => void`):

```ts
  onRequireLogin: (path: string) => void
  loginContextMessage: string
```

- [ ] **Step 5: Atualizar `AppRouter.tsx`**

Adicionar `useEffect` ao import do React (linha 2 atual: `import { lazy, Suspense } from 'react'`) →

```ts
import { lazy, Suspense, useEffect } from 'react'
```

Substituir o guard de sessão:

```tsx
  // Guarda de sessão: rota protegida sem usuário volta para o login. `replace`
  // evita que o botão voltar caia de novo na rota bloqueada.
  if (!authUser && isProtected(location)) {
    return <Redirect href={ROUTES.login} replace />
  }
```

por:

```tsx
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
```

No `<Route path={ROUTE_PATTERNS.login}>`, adicionar o prop `contextMessage`:

```tsx
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
          contextMessage={props.loginContextMessage}
        />
      </Route>
```

- [ ] **Step 6: Atualizar `LoginScreen.tsx`**

Na interface `LoginScreenProps`, adicionar (após `isDevMode: boolean`):

```ts
  contextMessage: string
```

Na assinatura da função, adicionar `contextMessage,` (após `isDevMode,`).

No JSX, logo após o bloco `<div className="mt-6 rounded-[28px] bg-slate-900 p-6 text-white">...</div>` (o bloco com o `<h1>`) e antes do `<form onSubmit={onSubmit} ...>`, inserir:

```tsx
        {contextMessage ? (
          <p className="mt-4 rounded-[16px] bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {contextMessage}
          </p>
        ) : null}
```

- [ ] **Step 7: Reescrever os trechos relevantes de `useMarketplaceState.ts`**

Trocar a linha:

```ts
  const [, navigate] = useLocation()
```

por:

```ts
  const [location, navigate] = useLocation()
```

Adicionar import (após `import { STORAGE_KEYS, clearSession } from './session'`):

```ts
import { pendingIntentMessage } from './pendingIntent'
```

Trocar o efeito de persistência do carrinho:

```ts
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.cart, session.authUser ? cartCheckout.cartState : null)
  }, [session.authUser, cartCheckout.cartState])
```

por (carrinho de visitante sobrevive a reload — ver Task 5 para o teste):

```ts
  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.cart, cartCheckout.cartState)
  }, [cartCheckout.cartState])
```

Logo após a definição de `handleCartContinue` (mantém como está, sem checar
sessão — vira a versão "já autenticado" usada tanto pelo clique direto quanto
pela retomada pós-login) e antes de `handleRepeatOrder`, adicionar:

```ts
  const guardedToggleFavorite = (product: Product) => {
    if (!session.authUser) {
      session.redirectToLogin(location, { type: 'favorite', productId: product.id })
      return
    }
    catalog.toggleFavorite(product)
  }

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
      cartCheckout.handleAddToCart(product)
      session.redirectToLogin(location, { type: 'resume-checkout' })
      return
    }
    cartCheckout.handleBuyNow(product)
  }

  /** Roda depois de login/cadastro bem-sucedido: resolve a intenção pendente e volta para onde a pessoa estava. */
  const resolvePendingLoginAndNavigate = () => {
    if (session.pendingIntent?.type === 'favorite') {
      const product = products.find((item) => item.id === session.pendingIntent?.productId)
      if (product) catalog.toggleFavorite(product)
    } else if (session.pendingIntent?.type === 'resume-checkout') {
      handleCartContinue()
      cartCheckout.setIsCartOpen(true)
    }
    navigate(session.pendingReturnTo ?? ROUTES.home)
    session.clearPendingLogin()
  }

  const onAuthSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const success = session.handleAuthSubmit(event)
    if (success) resolvePendingLoginAndNavigate()
  }

  const onQuickLogin = (role: Role) => {
    session.handleQuickLogin(role)
    resolvePendingLoginAndNavigate()
  }
```

Precisa de `Role` no import de tipos — já está importado no topo do arquivo
(`import type { ... Role, ... } from './types'`), confirmar que continua lá.

No objeto de retorno, trocar:

```ts
    onAuthSubmit: session.handleAuthSubmit,
    onQuickLogin: session.handleQuickLogin,
```

por:

```ts
    onAuthSubmit,
    onQuickLogin,
    onRequireLogin: session.recordReturnTo,
    loginContextMessage: pendingIntentMessage(session.pendingIntent),
```

E trocar:

```ts
    onToggleFavorite: catalog.toggleFavorite,
```

por:

```ts
    onToggleFavorite: guardedToggleFavorite,
```

E trocar:

```ts
    onAddToCart: cartCheckout.handleAddToCart,
    onBuyNow: cartCheckout.handleBuyNow,
```

por:

```ts
    onAddToCart: cartCheckout.handleAddToCart,
    onBuyNow: guardedBuyNow,
```

E trocar:

```ts
    onCartContinue: handleCartContinue,
```

por:

```ts
    onCartContinue: guardedCartContinue,
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `npx vitest run src/test/guest-checkout.test.tsx`
Expected: PASS (8 testes).

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 9: Commit**

```bash
git add src/state/useSessionState.ts src/state/useMarketplaceState.ts src/router/AppRouterProps.ts src/router/AppRouter.tsx src/screens/LoginScreen.tsx src/test/guest-checkout.test.tsx
git commit -m "feat: favoritar e avancar checkout como visitante pedem login com retomada"
```

---

## Task 5: Carrinho de visitante sobrevive a reload

**Files:**
- Create: `src/test/authTestHelpers.ts`
- Modify: `src/test/persistence.test.tsx`

**Interfaces:**
- Consumes: link "Entrar" da Task 3; comportamento de persistência já implementado na Task 4 Step 7 (este teste só precisava ser escrito — a implementação já aconteceu).
- Produces: `enterAsClient()`, `clickEnterAsClient()`, `goToLoginFromNav()` em `src/test/authTestHelpers.ts` — consumidos pela Task 6.

- [ ] **Step 1: Criar o helper compartilhado de teste**

```ts
// src/test/authTestHelpers.ts
import { fireEvent, render, screen, within } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'

/**
 * Vai para /entrar pelo ponto de entrada real: o link "Entrar" da barra de
 * navegação, visível na home (pública) quando ninguém está logado. Pressupõe
 * que o app já foi renderizado e a home está na tela.
 */
export const goToLoginFromNav = () => {
  const nav = screen.getByRole('navigation', { name: /navegação principal/i })
  fireEvent.click(within(nav).getByRole('link', { name: /^entrar$/i }))
}

/** Vai para /entrar e loga como cliente pelo atalho de desenvolvimento. Pressupõe app já renderizado. */
export const clickEnterAsClient = () => {
  goToLoginFromNav()
  fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))
}

/** Renderiza o app do zero e loga como cliente. */
export const enterAsClient = () => {
  render(<MarketplaceApp />)
  clickEnterAsClient()
}
```

- [ ] **Step 2: Escrever o teste que falha (carrinho de visitante) e corrigir os que quebram**

Em `src/test/persistence.test.tsx`, trocar o import e o helper local:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'
import { STORAGE_KEYS } from '../state/session'
```

por:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'
import { STORAGE_KEYS } from '../state/session'
import { enterAsClient } from './authTestHelpers'
```

Remover a definição local:

```ts
  const enterAsClient = () => {
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))
  }
```

(o `enterAsClient` importado já faz `render` + navegação + login — os call
sites `enterAsClient()` não mudam).

Adicionar, dentro de `describe('sobrevive ao reload', ...)`, um novo caso:

```ts
    it('carrinho de visitante sobrevive ao reload sem sessao', () => {
      const first = render(<MarketplaceApp />)
      fireEvent.click(
        screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement,
      )
      first.unmount()

      render(<MarketplaceApp />)
      const nav = screen.getByRole('navigation', { name: /navegação principal/i })
      expect(within(nav).getByRole('button', { name: /carrinho — 1 itens/i })).toBeInTheDocument()
    })
```

Trocar as 4 asserções de "app não crashou" que dependiam do login ser a tela
padrão. Primeiro caso:

```ts
    it('JSON invalido cai no fallback', () => {
      localStorage.setItem(STORAGE_KEYS.agents, '{isso nao e json')
      localStorage.setItem(STORAGE_KEYS.orders, 'null null')

      expect(() => render(<MarketplaceApp />)).not.toThrow()
      expect(screen.getByRole('button', { name: /entrar como cliente/i })).toBeInTheDocument()
    })
```

vira:

```ts
    it('JSON invalido cai no fallback', () => {
      localStorage.setItem(STORAGE_KEYS.agents, '{isso nao e json')
      localStorage.setItem(STORAGE_KEYS.orders, 'null null')

      expect(() => render(<MarketplaceApp />)).not.toThrow()
      expect(screen.getByRole('navigation', { name: /navegação principal/i })).toBeInTheDocument()
    })
```

Segundo caso (também precisa provar "sem sessão", não só "não crashou" —
verificar o item "Entrar" da barra em vez do botão de login):

```ts
    it('JSON valido com formato errado nao concede sessao', () => {
      // Sem `email`, o objeto nao e um usuario valido.
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ apelido: 'Fulano' }))

      render(<MarketplaceApp />)
      expect(screen.getByRole('button', { name: /entrar como cliente/i })).toBeInTheDocument()
    })
```

vira:

```ts
    it('JSON valido com formato errado nao concede sessao', () => {
      // Sem `email`, o objeto nao e um usuario valido.
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ apelido: 'Fulano' }))

      render(<MarketplaceApp />)
      const nav = screen.getByRole('navigation', { name: /navegação principal/i })
      expect(within(nav).getByRole('link', { name: 'Entrar' })).toBeInTheDocument()
    })
```

Terceiro e quarto casos (dentro de `describe('storage indisponivel', ...)`),
mesma troca de asserção:

```ts
    it('app sobe quando localStorage lanca ao ser acessado', () => {
      const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('acesso negado (aba privada)')
        },
      })

      try {
        expect(() => render(<MarketplaceApp />)).not.toThrow()
        expect(screen.getByRole('button', { name: /entrar como cliente/i })).toBeInTheDocument()
      } finally {
        if (original) Object.defineProperty(window, 'localStorage', original)
      }
    })

    it('interagir sem storage nao quebra o fluxo', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded')
      })

      try {
        render(<MarketplaceApp />)
        // Sem storage funcional o app ainda tem que renderizar a entrada.
        expect(screen.getByRole('button', { name: /entrar como cliente/i })).toBeInTheDocument()
      } finally {
        setItem.mockRestore()
      }
    })
```

viram:

```ts
    it('app sobe quando localStorage lanca ao ser acessado', () => {
      const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('acesso negado (aba privada)')
        },
      })

      try {
        expect(() => render(<MarketplaceApp />)).not.toThrow()
        expect(screen.getByRole('navigation', { name: /navegação principal/i })).toBeInTheDocument()
      } finally {
        if (original) Object.defineProperty(window, 'localStorage', original)
      }
    })

    it('interagir sem storage nao quebra o fluxo', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded')
      })

      try {
        render(<MarketplaceApp />)
        // Sem storage funcional o app ainda tem que renderizar a entrada.
        expect(screen.getByRole('navigation', { name: /navegação principal/i })).toBeInTheDocument()
      } finally {
        setItem.mockRestore()
      }
    })
```

- [ ] **Step 3: Rodar e confirmar que passa**

Run: `npx vitest run src/test/persistence.test.tsx`
Expected: PASS (todos os casos, incluindo o novo de carrinho de visitante).

- [ ] **Step 4: Commit**

```bash
git add src/test/authTestHelpers.ts src/test/persistence.test.tsx
git commit -m "feat: carrinho de visitante sobrevive a reload sem sessao"
```

---

## Task 6: Corrigir a colateral em outros arquivos de teste

Estes arquivos assumiam que `render(<MarketplaceApp />)` mostrava a tela de
login por padrão (verdade quando `/` era protegido). Agora `/` é a vitrine —
cada um precisa navegar até `/entrar` primeiro (pelo link real "Entrar",
igual ao helper da Task 5).

**Files:**
- Modify: `src/test/cart-quantity.test.tsx`
- Modify: `src/test/catalog.test.tsx`
- Modify: `src/test/checkout.test.tsx`
- Modify: `src/test/search.test.tsx`
- Modify: `src/test/favorites.test.tsx`
- Modify: `src/test/orders-history.test.tsx`
- Modify: `src/test/admin.test.tsx`
- Modify: `src/test/a11y.test.tsx`
- Modify: `src/test/screens.test.tsx`

**Interfaces:**
- Consumes: `enterAsClient`, `clickEnterAsClient`, `goToLoginFromNav` de `src/test/authTestHelpers.ts` (Task 5).

- [ ] **Step 1: Rodar a suíte inteira e listar as falhas restantes**

Run: `npx vitest run`
Expected: FAIL nos 9 arquivos listados acima — todas por causa do padrão
"assume tela de login por padrão".

- [ ] **Step 2: `cart-quantity.test.tsx`, `catalog.test.tsx`, `checkout.test.tsx`, `search.test.tsx` — trocar helper local pelo importado**

Em cada um dos 4 arquivos, o import no topo ganha a linha (ajustar o path
relativo, todos ficam em `src/test/`, então é sempre `./authTestHelpers`):

```ts
import { enterAsClient } from './authTestHelpers'
```

E a definição local é removida — em `cart-quantity.test.tsx`, `catalog.test.tsx`
e `checkout.test.tsx` e `search.test.tsx`, remover exatamente:

```ts
  const enterAsClient = () => {
    render(<MarketplaceApp />)
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))
  }
```

Nenhum call site (`enterAsClient()`) muda — o helper importado tem o mesmo
comportamento (renderiza e loga).

- [ ] **Step 3: `favorites.test.tsx`, `orders-history.test.tsx` — trocar helper local pelo importado (variante "já renderizado")**

Nestes dois arquivos, a definição local NÃO renderiza sozinha (o teste chama
`render(<MarketplaceApp />)` antes, separadamente). Import:

```ts
import { clickEnterAsClient as enterAsClient } from './authTestHelpers'
```

Remover a definição local (mesmo texto nos dois arquivos):

```ts
  const enterAsClient = () => {
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))
  }
```

Call sites continuam `enterAsClient()`, sem mudança.

- [ ] **Step 4: `admin.test.tsx` — inserir a navegação antes do login de operação**

Import:

```ts
import { goToLoginFromNav } from './authTestHelpers'
```

Trocar:

```ts
  const enterAsAdmin = async () => {
    render(<MarketplaceApp />)
    fireEvent.click(screen.getByRole('button', { name: /entrar como operação/i }))
    // Para operação, o item "Mais" da barra leva ao painel.
    fireEvent.click(screen.getByRole('link', { name: /^mais$/i }))
    await screen.findByRole('tab', { name: /agentes/i })
  }
```

por:

```ts
  const enterAsAdmin = async () => {
    render(<MarketplaceApp />)
    goToLoginFromNav()
    fireEvent.click(screen.getByRole('button', { name: /entrar como operação/i }))
    // Para operação, o item "Mais" da barra leva ao painel.
    fireEvent.click(screen.getByRole('link', { name: /^mais$/i }))
    await screen.findByRole('tab', { name: /agentes/i })
  }
```

- [ ] **Step 5: `a11y.test.tsx` — múltiplos pontos**

Import, adicionar:

```ts
import { clickEnterAsClient as enterAsClient, goToLoginFromNav } from './authTestHelpers'
```

Remover a definição local:

```ts
  const enterAsClient = () => {
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))
  }
```

No teste "tela de login sem violacao critica ou seria" (que testa a tela de
login isoladamente, sem passar por `enterAsClient`), navegar explicitamente
antes de renderizar:

```ts
  it('tela de login sem violacao critica ou seria', async () => {
    const { container } = render(<MarketplaceApp />)
    const violations = blocking((await axe(container)) as AxeResults)
    expect(describeViolations(violations)).toBe('')
  })
```

vira:

```ts
  it('tela de login sem violacao critica ou seria', async () => {
    window.history.pushState({}, '', ROUTES.login)
    const { container } = render(<MarketplaceApp />)
    const violations = blocking((await axe(container)) as AxeResults)
    expect(describeViolations(violations)).toBe('')
  })
```

(`ROUTES` já está importado no topo do arquivo.)

Nos dois testes que logam como operação diretamente (sem usar `enterAsClient`),
inserir `goToLoginFromNav()` antes do clique em "Entrar como operação". Teste
"painel admin sem violacao critica ou seria":

```ts
  it('painel admin sem violacao critica ou seria', async () => {
    const { container } = render(<MarketplaceApp />)
    fireEvent.click(screen.getByRole('button', { name: /entrar como operação/i }))
    fireEvent.click(screen.getByRole('link', { name: /^mais$/i }))
```

vira:

```ts
  it('painel admin sem violacao critica ou seria', async () => {
    const { container } = render(<MarketplaceApp />)
    goToLoginFromNav()
    fireEvent.click(screen.getByRole('button', { name: /entrar como operação/i }))
    fireEvent.click(screen.getByRole('link', { name: /^mais$/i }))
```

(o resto do teste, dali para baixo, não muda). Mesma edição no segundo
describe (`'semantica dos controles'`), teste "a hierarquia de titulos comeca
em h1 e nao pula nivel":

```ts
  it('a hierarquia de titulos comeca em h1 e nao pula nivel', async () => {
    render(<MarketplaceApp />)
    fireEvent.click(screen.getByRole('button', { name: /entrar como operação/i }))
    fireEvent.click(screen.getByRole('link', { name: /^mais$/i }))
```

vira:

```ts
  it('a hierarquia de titulos comeca em h1 e nao pula nivel', async () => {
    render(<MarketplaceApp />)
    goToLoginFromNav()
    fireEvent.click(screen.getByRole('button', { name: /entrar como operação/i }))
    fireEvent.click(screen.getByRole('link', { name: /^mais$/i }))
```

Nos 3 testes restantes do describe `'semantica dos controles'` que logam
como cliente diretamente (sem usar o helper `enterAsClient` — chamam
`fireEvent.click` duas vezes: no botão de login), inserir `goToLoginFromNav()`
antes do clique em "Entrar como cliente". Aplica-se aos testes "nenhum botao
de icone fica sem nome acessivel", "todo campo de formulario do checkout tem
label associado" e "a gaveta do carrinho se declara como dialogo modal" — em
cada um, a linha:

```ts
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))
```

(a que vem logo após `render(<MarketplaceApp />)`) ganha, imediatamente
antes:

```ts
    goToLoginFromNav()
```

- [ ] **Step 6: `screens.test.tsx` — testes de `LoginScreen`**

No `describe('LoginScreen — validacao', ...)`, o `beforeEach` atual:

```ts
  beforeEach(() => {
    localStorage.clear()
  })
```

vira (navegar direto para `/entrar`, já que estes dois testes checam a tela
de login isoladamente, sem passar pelo fluxo de descoberta):

```ts
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/entrar')
  })
```

Confirmar que o arquivo já importa algo de `../router/routes` — se não
importar, não é necessário: `'/entrar'` como string literal aqui é aceitável
porque o teste já usa strings literais para os placeholders (`'Seu nome'`) em
vez de `ROUTES`.

- [ ] **Step 7: Rodar a suíte inteira**

Run: `npx vitest run`
Expected: PASS — todos os arquivos, sem exceção.

- [ ] **Step 8: Rodar lint e typecheck**

Run: `npm run lint`
Expected: 0 erros.

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 9: Commit**

```bash
git add src/test/cart-quantity.test.tsx src/test/catalog.test.tsx src/test/checkout.test.tsx src/test/search.test.tsx src/test/favorites.test.tsx src/test/orders-history.test.tsx src/test/admin.test.tsx src/test/a11y.test.tsx src/test/screens.test.tsx
git commit -m "test: corrige helpers de login apos vitrine ficar publica"
```

---

## Task 7: E2E

**Files:**
- Modify: `e2e/auth.spec.js`
- Modify: `e2e/navigation.spec.js`
- Create: `e2e/guest-checkout.spec.js`

**Interfaces:**
- Consumes: comportamento das Tasks 2–4, já implementado e coberto por testes unitários — aqui só valida ponta a ponta contra um browser real.

- [ ] **Step 1: Corrigir `e2e/auth.spec.js`**

Os dois primeiros testes (`'criar conta, entrar e sair limpa a sessao'` e
`'rejeita e-mail malformado sem autenticar'`) começam com `await page.goto('/')`
e imediatamente interagem com campos que só existem em `/entrar`. Trocar, nos
dois testes, a primeira linha do corpo:

```js
    await page.goto('/')
```

por:

```js
    await page.goto('/entrar')
```

O terceiro teste (`'papel admin gravado a mao...'`) já usa `page.goto('/')`
seguido de `page.reload()` com um usuário válido no localStorage — continua
funcionando sem mudança, porque o `authUser` normalizado torna essa pessoa
autenticada (o item "Mais" aparece normalmente).

- [ ] **Step 2: Corrigir `e2e/navigation.spec.js`**

O teste `'/product/:id sem sessao redireciona para login'` inverteu de
comportamento — produto agora é público. Trocar:

```js
  test('/product/:id sem sessao redireciona para login', async ({ page }) => {
    // Acessa /produto/1 sem estar autenticado
    await page.goto('/produto/1')

    // Valida que foi redirecionado para login
    await expect(page.getByLabel('E-mail')).toBeVisible()
    await expect(page.getByLabel('Senha')).toBeVisible()
  })
```

por:

```js
  test('/produto/:id continua acessivel sem sessao — rota publica', async ({ page }) => {
    await page.goto('/produto/1')

    await expect(
      page.getByRole('heading', { name: /ventilador de mesa premium/i }),
    ).toBeVisible()
    await expect(page.getByLabel('Senha')).toBeHidden()
  })
```

O teste `'/admin sem sessao redireciona para login'` continua sem mudança —
admin segue protegido.

- [ ] **Step 3: Criar `e2e/guest-checkout.spec.js`**

```js
import { expect, test } from '@playwright/test'

/**
 * E2E do fluxo de visitante: navegar, favoritar/pagar exige login, e a
 * intenção é retomada automaticamente após entrar.
 */
test.describe('visitante', () => {
  test('favoritar redireciona para login e aplica o favorito ao retornar', async ({ page }) => {
    await page.goto('/')

    const heart = page.getByRole('button', { name: /^salvar .+ nos favoritos$/i }).first()
    const label = await heart.getAttribute('aria-label')
    const title = label?.replace(/^Salvar /, '').replace(/ nos favoritos$/, '') ?? ''

    await heart.click()

    await expect(page.getByLabel('Senha')).toBeVisible()
    await expect(page.getByText(/faça login para favoritar/i)).toBeVisible()

    await page.getByLabel('Seu nome').fill('Ana Paula')
    // A tela de login abre no modo "Entrar" por padrao; trocar para "Criar conta".
    await page.getByRole('button', { name: /^criar conta$/i }).first().click()
    await page.getByLabel('Seu nome').fill('Ana Paula')
    await page.getByLabel('E-mail').fill('ana@teste.com')
    await page.getByLabel('Senha').fill('segredo123')
    await page.getByRole('button', { name: /^criar conta$/i }).last().click()

    await expect(page).toHaveURL('/')
    await expect(
      page.getByRole('button', { name: new RegExp(`^Remover ${title} dos favoritos$`, 'i') }),
    ).toBeVisible()
  })

  test('continuar no carrinho redireciona para login e retoma a etapa de entrega', async ({ page }) => {
    await page.goto('/')

    await page
      .getByRole('button', { name: /adicionar .* ao carrinho/i })
      .first()
      .click()
    await page.getByRole('button', { name: /continuar/i }).click()

    await expect(page.getByLabel('Senha')).toBeVisible()
    await expect(page.getByText(/faça login para continuar sua compra/i)).toBeVisible()

    await page.getByRole('button', { name: /^criar conta$/i }).first().click()
    await page.getByLabel('Seu nome').fill('Ana Paula')
    await page.getByLabel('E-mail').fill('ana@teste.com')
    await page.getByLabel('Senha').fill('segredo123')
    await page.getByRole('button', { name: /^criar conta$/i }).last().click()

    await expect(page.getByLabel('Seu nome')).toBeVisible()
    const nav = page.getByRole('navigation', { name: /navegação principal/i })
    await expect(nav.getByRole('button', { name: /carrinho — 1 itens/i })).toBeVisible()
  })

  test('clicar em Entrar na barra inferior vai direto para /entrar', async ({ page }) => {
    await page.goto('/')

    const nav = page.getByRole('navigation', { name: /navegação principal/i })
    await nav.getByRole('link', { name: 'Entrar' }).click()

    await expect(page).toHaveURL('/entrar')
    await expect(page.getByText(/faça login para/i)).toBeHidden()
  })
})
```

- [ ] **Step 4: Rodar o build e os testes E2E**

Run: `npm run build`
Expected: build sem erros.

Run: `npx playwright test`
Expected: PASS em todos os specs, chromium + webkit (os cenários de admin
seguem `test.describe.skip`, sem porta de entrada em produção — sem mudança).

- [ ] **Step 5: Rodar 3 vezes para confirmar zero flake**

Run: `npx playwright test` (repetir mais 2 vezes)
Expected: PASS nas 3 execuções, sem instabilidade.

- [ ] **Step 6: Commit**

```bash
git add e2e/auth.spec.js e2e/navigation.spec.js e2e/guest-checkout.spec.js
git commit -m "test: E2E do fluxo de visitante — favoritar, checkout e Entrar"
```

---

## Task 8: Gate final e push

**Files:** nenhum (só verificação).

- [ ] **Step 1: Gate completo**

Run: `npm run lint && npm run typecheck && npx vitest run && npm run build && npm run check:bundle`
Expected: tudo verde — 0 erros de lint, 0 erros de tipo, todos os testes
unitários passando, build ok, bundle dentro do orçamento (330 KB).

- [ ] **Step 2: E2E completo**

Run: `npx playwright test`
Expected: PASS.

- [ ] **Step 3: Push**

```bash
git push origin main
```

- [ ] **Step 4: Confirmar CI verde**

Run: `gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`
Expected: todos os jobs (lint, typecheck, test, build, e2e) verdes.
