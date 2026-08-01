# Orquestração de Agentes — Primeiro Aqui

Documento de execução para agentes de IA (GitHub Copilot / Copilot Workspace / Copilot CLI).
Cada **WU** (Work Unit) é uma tarefa autocontida: um agente pega, executa, valida e entrega.

> **Regra zero:** nenhuma WU é considerada concluída sem o **Gate** verde.
> Rodar o comando, ler a saída, colar o resultado. Sem evidência, não está pronto.

---

## 0. Contexto do projeto

| Item | Valor |
|---|---|
| Nome | Primeiro Aqui — marketplace local |
| Stack atual | React 19 + Vite 8 + Tailwind 3, JavaScript puro |
| Arquivo crítico | `src/MarketplaceApp.jsx` — 1.345 linhas, monólito com todas as telas |
| Estado | `useState` + `localStorage` (10 `useEffect` de persistência) |
| Backend | **Não existe ainda** — dados 100% mockados |
| Testes | **Zero** |
| Tipagem | Nenhuma (JS puro, sem `strict`) |
| Deploy | GitHub Actions → Vercel |

**Telas existentes:** `login`, `home`, `tracking`, `profile`, `admin` (tabs: overview / agents / orders / performance).

**Alvo de stack (contrato KoraForce):** TypeScript `strict`, Postgres + Prisma, API Hono, Docker, portabilidade total (sem lock-in de plataforma).

---

## 1. Stack de testes — decisão fixa

Não negociar, não substituir sem justificar em ADR.

### Frontend
| Camada | Ferramenta | Escopo |
|---|---|---|
| Unitário | **Vitest** | funções puras, reducers, helpers |
| Componente | **@testing-library/react** + `jest-dom` | render, interação, acessibilidade |
| Ambiente DOM | **jsdom** | — |
| Mock de rede | **MSW** (Mock Service Worker) | handlers em `src/test/mocks/` |
| E2E | **Playwright** | fluxos críticos ponta a ponta |
| Cobertura | `@vitest/coverage-v8` | mínimo **80%** em `src/lib` e `src/state` |

### Backend (quando existir — WU-20+)
| Camada | Ferramenta | Escopo |
|---|---|---|
| Unitário | **Vitest** | services, validators, regras de negócio |
| Integração | **Vitest + Supertest** (ou `app.request()` do Hono) | rotas HTTP reais |
| Banco de teste | **Postgres em Docker** (`testcontainers` ou compose dedicado) | **nunca mockar o Prisma em teste de integração** |
| Contrato | **Zod** schemas compartilhados | validam request/response nos dois lados |
| Cobertura | `@vitest/coverage-v8` | mínimo **85%** em `src/services` |

### Regras de teste (valem para todos os agentes)

1. **TDD obrigatório.** Escreva o teste que falha → veja falhar → implemente → veja passar. Um agente que entrega implementação sem teste prévio teve a WU rejeitada.
2. **Nada de teste tautológico.** `expect(true).toBe(true)` ou teste que só reexecuta a implementação é lixo. O teste prova comportamento observável.
3. **Sem mock do que você está testando.** Mocke fronteiras (rede, relógio, storage), nunca a unidade sob teste.
4. **Determinismo.** Nada de `Date.now()` ou `Math.random()` solto — injete. Testes com `sleep` são proibidos; use fake timers.
5. **Um teste, uma asserção conceitual.** Nome do teste descreve o comportamento, não a função.
6. **Teste de regressão obrigatório para cada bug corrigido** — o teste deve falhar no código antigo.

---

## 2. Gate determinístico

Todo agente roda isto antes de declarar conclusão. Falhou = não entregou.

```bash
npm run lint          # eslint, zero warnings
npm run typecheck     # tsc --noEmit   (a partir da WU-10)
npm run test:unit     # vitest run
npm run test:cov      # vitest run --coverage  (respeita os mínimos)
npm run build         # vite build
npm run test:e2e      # playwright test   (só nas WUs marcadas E2E)
```

Scripts a criar em `package.json` na **WU-01**:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:unit": "vitest run",
    "test:cov": "vitest run --coverage",
    "test:e2e": "playwright test",
    "gate": "npm run lint && npm run typecheck && npm run test:unit && npm run build"
  }
}
```

---

## 3. Papéis dos agentes

| Papel | Responsabilidade | Nunca faz |
|---|---|---|
| **A-SETUP** | Infra de testes, configs, CI, Docker | Lógica de negócio |
| **A-TEST** | Escreve os testes que falham (fase RED do TDD) | Implementa a correção |
| **A-IMPL** | Implementa até o teste passar (fase GREEN) | Altera o teste para passar |
| **A-REFACTOR** | Melhora estrutura com testes verdes | Muda comportamento |
| **A-BACK** | Schema Prisma, API Hono, services | Toca no frontend |
| **A-REVIEW** | Revisa diff, valida gate, aponta regressão | Aprova o próprio trabalho |

**Trava anti-conluio:** `A-TEST` e `A-IMPL` são agentes/sessões **distintos**. O `A-IMPL` não pode editar arquivos `*.test.ts(x)`. Se o teste parece errado, o `A-IMPL` reporta ao `A-REVIEW` — não corrige sozinho.

---

## 4. Bugs confirmados a corrigir

Cada um vira teste de regressão antes da correção.

| # | Arquivo:linha | Defeito | Impacto |
|---|---|---|---|
| B1 | `MarketplaceApp.jsx:362` | ID do pedido = `` `100${orders.length + 1}` `` | Colide após deletar pedido → dois pedidos com mesmo ID |
| B2 | `MarketplaceApp.jsx:298` | Carrinho é array sem quantidade | Adicionar o mesmo produto 2× duplica `key` do React; `handleRemoveFromCart` remove ambos |
| B3 | `MarketplaceApp.jsx:1092` | Logout só remove `primeiroaqui_user` | Carrinho, favoritos e mensagens vazam para o próximo usuário |
| B4 | `MarketplaceApp.jsx:189-193, 199-203, 221-225` | `useEffect` só grava se truthy | Estado nulo nunca é limpo do `localStorage` |
| B5 | `MarketplaceApp.jsx:271-291` | Auth aceita qualquer credencial; papel `admin` vem do `localStorage` | **Escalada de privilégio via DevTools** |
| B6 | `MarketplaceApp.jsx:29,40,51,62` | Imagens de `placehold.co` | Dependência externa em produção; quebra offline |
| B7 | `MarketplaceApp.jsx:174` | `storedMessages[0]?.id \|\| initialThreads[0].id` | Crash se `messageThreads` for `[]` e `initialThreads` mudar |
| B8 | `MarketplaceApp.jsx:133-144` | `readStoredJSON` não valida shape | JSON válido mas com formato errado quebra a UI silenciosamente |

---

## 5. Work Units

### FASE 1 — Infraestrutura de testes

---

#### WU-01 · Instalar e configurar Vitest + Testing Library
**Agente:** A-SETUP · **Depende de:** — · **Paralelizável:** sim

**Entregar:**
- Deps: `vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`
- `vitest.config.js` com `environment: 'jsdom'`, `setupFiles: './src/test/setup.js'`, `globals: true`
- `src/test/setup.js` importando `@testing-library/jest-dom/vitest` + `cleanup` no `afterEach`
- Thresholds de cobertura em `coverage.thresholds`
- Scripts `test`, `test:unit`, `test:cov` no `package.json`
- **Teste de fumaça** `src/test/smoke.test.js` que renderiza `<MarketplaceApp />` sem crashar

**Gate:** `npm run test:unit` passa com o smoke test verde.

---

#### WU-02 · Configurar MSW
**Agente:** A-SETUP · **Depende de:** WU-01 · **Paralelizável:** sim

**Entregar:**
- Dep `msw`
- `src/test/mocks/handlers.js` (vazio por ora, pronto para as rotas da WU-20+)
- `src/test/mocks/server.js` com `setupServer`
- Ligar no `setup.js`: `listen` / `resetHandlers` / `close`
- `onUnhandledRequest: 'error'` — requisição não mockada **quebra o teste**

**Gate:** `npm run test:unit` continua verde.

---

#### WU-03 · Configurar Playwright
**Agente:** A-SETUP · **Depende de:** WU-01 · **Paralelizável:** sim

**Entregar:**
- `npm i -D @playwright/test` + `npx playwright install --with-deps chromium`
- `playwright.config.js`: `webServer` apontando para `npm run preview`, `baseURL`, retries em CI
- `e2e/smoke.spec.js` — abre a home e verifica o título
- Script `test:e2e`

**Gate:** `npm run build && npm run test:e2e` verde.

---

#### WU-04 · CI: rodar o gate completo
**Agente:** A-SETUP · **Depende de:** WU-01, WU-03 · **Paralelizável:** não

**Entregar:** reescrever `.github/workflows/build.yml`:
- Jobs: `lint`, `typecheck`, `test`, `build`, `e2e`
- `npm ci` (não `npm install`)
- Upload do relatório de cobertura e do report do Playwright como artifacts
- **Branch protection:** merge bloqueado se o gate falhar
- Cache de `node_modules` e dos browsers do Playwright

**Gate:** push numa branch → todos os jobs verdes no Actions.

---

### FASE 2 — Extrair lógica testável

> O monólito não é testável do jeito que está. Antes de corrigir bugs, extrair a lógica pura.

---

#### WU-05 · Extrair helpers puros
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-01

**RED (A-TEST):** criar `src/lib/format.test.js` e `src/lib/storage.test.js` cobrindo:
- `formatCurrency`: valor inteiro, decimal, zero, negativo, `NaN` (deve lançar ou retornar fallback definido)
- `readStoredJSON`: chave ausente → fallback; JSON inválido → fallback; JSON válido → parse; **shape inválido → fallback** (B8)
- `writeStoredJSON`: grava `null` corretamente (B4)

**GREEN (A-IMPL):** criar `src/lib/format.js` e `src/lib/storage.js`; `readStoredJSON` recebe um validador opcional. Remover as versões inline do `MarketplaceApp.jsx`.

**Gate:** `npm run test:cov` — `src/lib` ≥ 80%.

---

#### WU-06 · Extrair reducer do carrinho (corrige B2)
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-05

**RED — casos obrigatórios em `src/state/cart.test.js`:**
- adicionar item novo → `quantity: 1`
- adicionar item existente → `quantity: 2`, array continua com 1 entrada
- remover item com `quantity: 2` → decrementa para 1
- remover item com `quantity: 1` → some do array
- `subtotal` = Σ `price × quantity`
- carrinho vazio → subtotal `0`
- `clear()` esvazia
- **regressão B2:** adicionar o mesmo produto 2× e remover 1× deixa `quantity: 1` (hoje remove os dois)

**GREEN:** `src/state/cart.js` — reducer puro com `{ items: [{ product, quantity }] }`. `MarketplaceApp` passa a consumir via `useReducer`.

**Gate:** cobertura de `src/state/cart.js` = **100%**. Não aceitar menos: é lógica de dinheiro.

---

#### WU-07 · Extrair lógica de pedidos (corrige B1)
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-06

**RED — `src/state/orders.test.js`:**
- criar pedido gera ID único mesmo após deletar pedidos anteriores (**regressão B1**)
- criar 100 pedidos → 100 IDs distintos
- `changeStatus` só aceita transições válidas: `Processando → Em rota → Entregue`
- transição inválida (`Entregue → Processando`) é rejeitada
- `total` do pedido = subtotal do carrinho no momento da criação
- geração de ID é **injetável** (sem `Date.now()` interno)

**GREEN:** `src/state/orders.js` com `createOrder(cart, delivery, { idGenerator })`.

**Gate:** cobertura 100%. Máquina de estados de status explícita.

---

#### WU-08 · Extrair sessão e limpeza no logout (corrige B3, B4)
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-05

**RED — `src/state/session.test.js`:**
- login grava usuário
- **regressão B3:** logout limpa `user`, `cart`, `favorites`, `messages`, `current_order`, `business`
- **regressão B4:** setar estado como `null` remove a chave do storage
- trocar de usuário não vaza dado do anterior

**GREEN:** `src/state/session.js` com `STORAGE_KEYS` centralizado e `clearSession()` iterando sobre ele.

**Gate:** cobertura 100%.

---

#### WU-09 · Quebrar o monólito
**Agente:** A-REFACTOR · **Depende de:** WU-05..WU-08

Estrutura alvo:

```
src/
  lib/            format, storage
  state/          cart, orders, session, agents
  data/           mocks (initialProducts, initialAgents, ...)
  components/     ProductCard, CartDrawer, Modal, MetricCard, ...
  screens/        LoginScreen, HomeScreen, TrackingScreen, ProfileScreen, AdminScreen
  test/           setup, mocks
```

Regras:
- **Zero mudança de comportamento.** Só movimentação.
- Cada componente extraído ganha teste de render + interação principal
- `MarketplaceApp.jsx` fica só com roteamento de tela e composição de estado
- Nenhum arquivo acima de **300 linhas**

**Gate:** gate completo verde + E2E dos fluxos da WU-17 passando idênticos ao antes.

---

### FASE 3 — TypeScript

---

#### WU-10 · Migrar para TypeScript strict
**Agente:** A-SETUP + A-REFACTOR · **Depende de:** WU-09

**Entregar:**
- `typescript`, `@types/*`, `tsconfig.json` com `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`
- Renomear `.js`/`.jsx` → `.ts`/`.tsx`
- Tipos de domínio em `src/types/`: `Product`, `CartItem`, `Order`, `OrderStatus`, `Agent`, `User`, `Role`, `Thread`
- **Proibido `any`.** Se travar, use `unknown` + narrow, e comente o porquê
- Script `typecheck` no gate e no CI

**Gate:** `npm run typecheck` com zero erro. Zero `any` (`grep -rn ": any" src/` vazio).

---

### FASE 4 — Testes de componente e E2E

---

#### WU-11 · Testes do fluxo de autenticação (corrige B5)
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-10

**RED:**
- submit sem e-mail/senha não autentica
- e-mail malformado é rejeitado com mensagem visível
- senha abaixo do mínimo é rejeitada
- **regressão B5:** papel `admin` gravado à mão no `localStorage` **não** concede acesso ao painel
- logout retorna à tela de login e limpa a sessão

**GREEN:** validação com Zod; papel deriva de fonte confiável (mock de servidor via MSW por ora; servidor real na WU-22). Os botões "Entrar como cliente/operação" viram atalhos **apenas de desenvolvimento**, atrás de `import.meta.env.DEV`.

**Gate:** teste de escalada de privilégio verde.

---

#### WU-12 · Testes de componente — catálogo e busca
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-10

Cobrir: filtro por categoria; busca por título e por vendedor; busca sem resultado mostra estado vazio; contador de itens confere; favoritar/desfavoritar alterna e persiste; clique no card abre o modal; botão "Adicionar" **não** abre o modal (`stopPropagation`).

**Gate:** `src/screens/HomeScreen` ≥ 80%.

---

#### WU-13 · Testes de componente — carrinho e checkout
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-10

Cobrir: carrinho vazio bloqueia "Continuar"; subtotal atualiza ao adicionar/remover; passo de entrega exige nome, endereço, cidade e CEP; CEP em formato inválido é rejeitado; troca de método de pagamento reflete no resumo; "Confirmar compra" cria pedido, esvazia carrinho e navega para tracking; falha ao criar pedido **não** esvazia o carrinho.

**Gate:** ≥ 85% no fluxo de checkout. É onde o dinheiro passa.

---

#### WU-14 · Testes de componente — painel admin
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-10

Cobrir: CRUD de agentes (criar, editar, deletar, validar campos obrigatórios); comissão aceita só `0..100`; mudança de status do pedido persiste; ranking ordena corretamente com empate; usuário `client` **não** consegue renderizar o painel.

**Gate:** ≥ 80%.

---

#### WU-15 · Acessibilidade
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-12..WU-14

- `vitest-axe` — zero violação crítica em cada tela
- Modais: foco preso, `Esc` fecha, foco volta ao gatilho
- Todo ícone-botão tem `aria-label`
- Inputs têm `<label>` associado (hoje só há `placeholder` — insuficiente)
- Contraste AA validado
- Navegação completa por teclado

**Gate:** zero violação `critical`/`serious` no axe.

---

#### WU-16 · Testes de persistência
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-10

Cobrir: reload preserva carrinho, favoritos e sessão; `localStorage` corrompido → app sobe com fallback (B8); `localStorage` indisponível (modo privado) → app não crasha; dado de versão antiga do schema é migrado ou descartado com segurança.

**Gate:** nenhum crash em nenhum cenário.

---

#### WU-17 · E2E dos fluxos críticos
**Agente:** A-TEST · **Depende de:** WU-03, WU-13

Specs em `e2e/`:
1. `auth.spec` — cadastro → login → logout
2. `purchase.spec` — buscar → abrir produto → adicionar → checkout → confirmar → ver tracking
3. `admin.spec` — login operação → criar agente → mudar status de pedido → validar no ranking
4. `responsive.spec` — mesmos fluxos em viewport mobile (nav inferior, barra flutuante)

Rodar em Chromium + WebKit. Sem `waitForTimeout` — só `expect` com auto-retry.

**Gate:** 4 specs verdes, 2 browsers, zero flake em 3 execuções seguidas.

---

### FASE 5 — Backend

> **Condicional:** só executar se o projeto for **Tier Sistema**. Em Tier Vitrine, pare na WU-17.

---

#### WU-20 · Schema Prisma + banco de teste
**Agente:** A-BACK · **Depende de:** WU-10

**Entregar:**
- `prisma/schema.prisma`: `User`, `Session`, `Product`, `Order`, `OrderItem`, `Agent`, `Thread`, `Message`, `BusinessProfile`
- Enums `OrderStatus`, `Role`, `AgentStatus` — nunca string livre
- `docker-compose.test.yml` com Postgres isolado
- `src/test/db.ts`: sobe schema, trunca entre testes, derruba no fim
- Seed determinístico

**Testes:** constraints (FK, unique, not-null) validadas por teste que **tenta violar e espera erro**. Cascade delete de `Order → OrderItem` verificada.

**Gate:** `npm run test:db` verde com Postgres real. Sem mock do Prisma aqui.

---

#### WU-21 · Services de domínio
**Agente:** A-TEST → A-BACK · **Depende de:** WU-20

Services: `OrderService`, `CartService`, `AgentService`, `ProductService`.

**RED — regras que precisam de teste:**
- pedido não pode ser criado com carrinho vazio
- preço é lido do **banco**, nunca do payload do cliente (anti-adulteração)
- estoque insuficiente rejeita o pedido
- transição de status inválida lança erro tipado
- pedido é criado em **transação** — falha parcial não deixa `OrderItem` órfão
- comissão de agente calculada sobre o total correto
- concorrência: dois pedidos simultâneos no último item — só um passa

**Gate:** cobertura de `src/services` ≥ 85%. Testes de transação e concorrência verdes.

---

#### WU-22 · API Hono + testes de integração
**Agente:** A-TEST → A-BACK · **Depende de:** WU-21

Rotas: `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /products`, `GET /products/:id`, `POST /orders`, `GET /orders`, `PATCH /orders/:id/status`, CRUD `/agents`.

**Testes de integração (`app.request()` — HTTP real, sem mock):**
- todo endpoint valida entrada com Zod → `400` com corpo de erro consistente
- rota protegida sem sessão → `401`
- `client` acessando rota de `admin` → `403` (**testar explicitamente**)
- `PATCH /orders/:id/status` só permite transições válidas → `422`
- ID inexistente → `404`
- payload malformado não derruba o servidor
- rate limit no login (proteção a força bruta)
- sessão em cookie `httpOnly`, `secure`, `sameSite=lax` — **papel nunca vem do cliente** (fecha B5 de verdade)

**Gate:** ≥ 90% das rotas cobertas. Matriz de autorização (papel × rota) 100% testada.

---

#### WU-23 · Conectar frontend ao backend
**Agente:** A-IMPL · **Depende de:** WU-22

- `src/api/client.ts` tipado, schemas Zod compartilhados entre front e back
- Handlers MSW derivados dos **mesmos** schemas — mock que diverge do servidor real é pior que nenhum mock
- Estados de loading, erro e retry em cada chamada
- `localStorage` deixa de ser fonte de verdade; vira cache com TTL
- E2E da WU-17 reexecutado contra o backend real

**Gate:** gate completo + E2E contra a API real. Nenhum teste antigo pode ter sido enfraquecido para passar.

---

### FASE 6 — Portabilidade

---

#### WU-30 · Docker e deploy portável
**Agente:** A-SETUP · **Depende de:** WU-23

- `Dockerfile` multi-stage (build → runtime enxuto)
- `docker-compose.yml`: app + Postgres + MinIO
- Imagens de produto saem de `placehold.co` para storage S3-compatível (**fecha B6**)
- `.env.example` documentado; **conferir que `.env.local` está no `.gitignore`** (verificar antes de qualquer commit)
- Healthcheck `GET /health` com teste
- Deploy validado em VPS/Coolify — Vercel vira opção, não requisito

**Gate:** `docker compose up` sobe tudo do zero e a suíte E2E passa contra o container.

---

## 6. Grafo de dependências

```
WU-01 ─┬─ WU-02
       ├─ WU-03 ──┐
       └─ WU-05 ──┼─ WU-06 ── WU-07 ─┐
                  │                   ├─ WU-09 ── WU-10 ─┬─ WU-11
       WU-04 ◄────┘   WU-08 ──────────┘                   ├─ WU-12 ─┐
                                                          ├─ WU-13 ─┼─ WU-15
                                                          ├─ WU-14 ─┘
                                                          ├─ WU-16
                                                          └─ WU-20 ── WU-21 ── WU-22 ── WU-23 ── WU-30
                                            WU-17 ◄───────────┘
```

**Paralelizáveis:** (WU-02, WU-03, WU-05) · (WU-06+WU-07, WU-08) · (WU-11..WU-14, WU-16)

---

## 7. Protocolo por WU

Cada agente segue exatamente isto:

1. **Ler** este arquivo e a WU designada.
2. **Confirmar dependências** concluídas e com gate verde. Se não, parar e reportar.
3. **RED** — escrever os testes listados. Rodar. **Colar a saída mostrando a falha.**
   Teste que já passa antes da implementação é teste inútil — refazer.
4. **GREEN** — implementar o mínimo para passar. Nada além do escopo da WU.
5. **REFACTOR** — limpar com os testes verdes.
6. **Gate** — rodar os comandos da seção 2. **Colar a saída completa.**
7. **Entregar** — 1 commit por WU: `WU-XX: <descrição>`.
8. **Review** — `A-REVIEW` valida diff e gate. Só ele fecha a WU.

### Proibições absolutas

- ❌ Alterar teste para fazer implementação passar
- ❌ `it.skip`, `it.only`, `test.todo` em código entregue
- ❌ Reduzir threshold de cobertura para o gate passar
- ❌ `any` no TypeScript
- ❌ Commitar segredo (`.env`, chave, token)
- ❌ Declarar "pronto" sem colar a saída do gate
- ❌ Migration destrutiva, deploy ou integração de pagamento sem **confirmação humana explícita**

### Quando o agente deve parar e perguntar

- Um teste da WU parece testar comportamento errado
- A correção exige mudar contrato público não previsto na WU
- Dependência nova não listada aqui (→ acionar avaliação de prior-art e licença antes de adotar)
- Descoberta de bug fora do escopo (registrar, não corrigir silenciosamente)

---

## 8. Definição de Pronto

Uma WU está pronta quando **todos** valem:

- [ ] Testes escritos antes da implementação (evidência: teste falhando na saída)
- [ ] Todos os testes verdes
- [ ] Cobertura no mínimo exigido pela WU
- [ ] `npm run gate` verde, saída colada
- [ ] Zero `any`, zero `skip`/`only`
- [ ] Bug corrigido tem teste de regressão que falha no código antigo
- [ ] Commit único e descritivo
- [ ] `A-REVIEW` aprovou

---

## 9. Métricas de saída do projeto

| Métrica | Meta |
|---|---|
| Cobertura global | ≥ 80% |
| Cobertura `src/state`, `src/services` | ≥ 90% |
| Cobertura do fluxo de checkout | ≥ 85% |
| Fluxos E2E críticos | 4/4 verdes em 2 browsers |
| Violações de acessibilidade `critical`/`serious` | 0 |
| Ocorrências de `any` | 0 |
| Erros de `tsc --noEmit` | 0 |
| Bugs B1–B8 | todos com teste de regressão |
| Arquivo com mais de 300 linhas | 0 |

---

## 10. Aviso final

Este documento não substitui julgamento. Se um agente encontra algo que contradiz o que está escrito aqui — um bug pior, uma premissa errada, um teste impossível — **reporta em vez de improvisar**. Especificação desatualizada seguida cegamente produz código errado com gate verde, que é o pior resultado possível.

Direção estética e review visual final são **sempre humanos**. O loop entrega "correto e funciona"; "bonito" é carimbado por uma pessoa.
