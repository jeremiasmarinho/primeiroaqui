# Orquestração — MVP Fase 2: funcionalidades e testes

Continuação de [`ORQUESTRACAO-AGENTES.md`](./ORQUESTRACAO-AGENTES.md).
**As regras daquele documento continuam valendo integralmente** — TDD, papéis,
proibições, protocolo por WU e Definição de Pronto. Este arquivo não as repete;
só define o trabalho novo.

---

> **STATUS — atualizado em 2026-08-01 após 2ª rodada de execução (A-PERF/A-REVIEW).**
> Concluídas: WU-40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52.
> `MarketplaceApp.tsx` caiu para 95 linhas (estado extraído em 6 hooks:
> `useSessionState`, `useCatalogState`, `useAddressesState`,
> `useCartCheckoutState`, `useOrdersAdminState`, `useMarketplaceState`).
> Roteamento real com `wouter`, telas de produto/loja/categoria/busca/
> favoritos/pedidos/endereços entregues. Nenhum arquivo `src/**/*.ts(x)`
> acima de 300 linhas.
>
> **Orçamento de bundle: resolvido.** Limite elevado de 300 → **330 kB** por
> decisão humana em 2026-08-01 (justificativa na seção 10 e no comentário de
> `scripts/check-bundle-size.mjs`). Build atual: 312,22 kB — dentro do teto.
>
> Gate após a 2ª rodada: lint 0 · typecheck 0 · 282 testes unitários em 26
> arquivos, todos verdes · build limpo 312,22 kB · `grep ": any"` vazio ·
> zero arquivo acima de 300 linhas · 6 specs E2E existentes (não executados
> nesta rodada — ver seção 10). Detalhes na seção 10; histórico da 1ª rodada
> na seção 9 (números daquela seção — 165 testes, 18 E2E — estão desatualizados
> pelas WUs concluídas depois).

## 1. Estado real em 2026-08-01 (medido, não estimado)

```
npm run lint    → 0 erros
npm run typecheck → 0 erros   ⚠ ver A1: não está checando nada
npx vitest run  → 10 arquivos, 63 testes, todos verdes
npm run build   → ✓ 496ms
npm run test:e2e → 1 spec (smoke)
```

Cobertura atual (`src/lib` + `src/state`):

| Arquivo | Stmts | Branch |
|---|---|---|
| images.js | 100% | 90.9% |
| orders.js | 100% | 94.4% |
| cart.js | 96.9% | 80% |
| storage.js | 85.2% | 75% |

### Concluído

| WU | O que |
|---|---|
| 01–04 | Vitest, MSW, Playwright, CI com 5 jobs |
| 05 | `lib/format`, `lib/storage` |
| 06 | reducer de carrinho com quantidade (corrige B2) |
| 07 | `state/orders` com ID injetável e máquina de status (corrige B1) |
| 08 | `state/session` com `clearSession` (corrige B3, B4) |
| — | Redesign da home em 7 componentes + `HomeScreen` |
| — | `lib/images` + ADR 0001 (corrige B6 parcialmente) |

### Pendente

| WU | Situação |
|---|---|
| 09 | **Parcial** — só a home foi extraída. `MarketplaceApp.jsx` tem **957 linhas** (limite: 300) |
| 10 | **Falso-verde** — ver A1 |
| 11 | Parcial — 5 testes de auth, inclui regressão B5 |
| 12 | Parcial — 4 testes de catálogo |
| 13 | Parcial — 3 testes de checkout |
| 14–16 | **Não iniciado** |
| 17 | **Não iniciado** — só o smoke |
| 20+ | Backend não iniciado |

---

## 2. Dívidas que bloqueiam o resto

Executar a Fase A **antes** da B. Construir funcionalidade sobre um gate que
mente e um arquivo de 957 linhas multiplica o custo de tudo depois.

---

### WU-40 · Consertar o typecheck falso-verde 🔴
**Agente:** A-SETUP · **Bloqueia:** tudo

`npm run typecheck` passa com 0 erros, mas **não verifica nada**:

```jsonc
// tsconfig.json
"allowJs": true,
"checkJs": false   // ← nenhum arquivo .js/.jsx é analisado
```

Todo o código-fonte é `.js`/`.jsx`. O job `typecheck` do CI é decorativo: um erro
de tipo real passa direto. Isso é pior que não ter typecheck — dá falsa confiança.

**Duas saídas. A decisão é humana, o agente não escolhe sozinho:**

| Opção | Custo | Resultado |
|---|---|---|
| **A — migrar para `.ts`/`.tsx`** | alto, ~1 dia | contrato do projeto cumprido, tipagem real |
| **B — `checkJs: true` + JSDoc** | médio | verificação real sem renomear arquivo, mas sem tipos de domínio |

Recomendação: **A**. O contrato KoraForce exige TypeScript `strict`, e adiar a
migração só aumenta o volume a migrar.

**Entregar (opção A):**
- Renomear `src/**/*.jsx` → `.tsx`, `src/**/*.js` → `.ts` (exceto configs)
- `checkJs` deixa de importar; `strict` já está ligado
- `src/types/index.ts`: `Product`, `CartItem`, `CartState`, `Order`, `OrderStatus`, `Agent`, `User`, `Role`, `Store`, `Customer`, `Thread`
- Props de todos os componentes tipadas
- **Zero `any`.** Se travar, `unknown` + narrow, com comentário do porquê

**Gate:** `npm run typecheck` acusa erro ao introduzir um bug de tipo proposital
(prove: introduza, rode, cole a saída, remova). `grep -rn ": any" src/` vazio.

---

### WU-41 · Terminar a quebra do monólito
**Agente:** A-REFACTOR · **Depende de:** WU-40

`MarketplaceApp.jsx` = 957 linhas com `renderLoginScreen`, `renderTrackingScreen`,
`renderProfileScreen`, `renderAdminScreen` inline.

**Entregar:**
- `src/screens/LoginScreen.tsx`, `TrackingScreen.tsx`, `ProfileScreen.tsx`
- `src/screens/admin/AdminScreen.tsx` + `OverviewTab`, `AgentsTab`, `OrdersTab`, `PerformanceTab`
- `src/components/CartDrawer.tsx`, `ProductModal.tsx`, `BusinessSetupModal.tsx`
- `MarketplaceApp.tsx` fica só com estado, handlers e roteamento
- **Nenhum arquivo acima de 300 linhas**

Regra: **zero mudança de comportamento.** Só movimentação. Os 63 testes atuais
precisam passar sem alteração de asserção.

**Gate:** `npm run gate` verde + `wc -l src/**/*.tsx | awk '$1>300'` vazio.

---

### WU-42 · Testar os componentes do redesign
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-40

Os 7 componentes da home foram entregues **sem teste próprio**. Estão cobertos
só indiretamente pelos testes de tela. É a maior lacuna atual.

| Componente | Casos obrigatórios |
|---|---|
| `Price` | centavos em sobrescrito; preço de lista some quando `listPrice <= price`; `% OFF` arredonda corretamente; `aria-label` traz o valor completo |
| `ProductCard` | favoritar alterna `aria-pressed`; adicionar não abre o detalhe; clicar no título abre; selo "Mais vendido" só com `bestSeller`; `onError` cai no placeholder |
| `Countdown` | decrementa com fake timers; para em `00 00 00`; chama `onExpire` uma vez só; limpa o intervalo no unmount; `aria-label` resume em minutos |
| `FlashDeals` | só entra produto com ≥15% de desconto; some quando não há nenhum; máximo 3 |
| `TopBar` | busca tem `<label>` associado; badge some com 0 notificações; aba ativa marca `aria-current` |
| `BottomNav` | exatamente 5 itens; nome acessível do carrinho inclui a contagem; item ativo marca `aria-current="page"` |
| `BannerCarousel` | indicador acompanha o slide; bolinhas são botões alcançáveis por teclado; **não** tem autoplay |

`Countdown` usa `vi.useFakeTimers()`. Proibido `waitForTimeout` ou `sleep`.

**Gate:** `src/components` ≥ 85% de linhas. Incluir `src/components/**` e
`src/screens/**` no `include` de cobertura do `vitest.config` — hoje só
`src/lib` e `src/state` entram, o que infla o número.

---

### WU-43 · Ligar ou remover dados órfãos
**Agente:** A-IMPL · **Depende de:** WU-40

`src/data/catalog.js` exporta `stores` (5) e `customers` (4) que **nenhuma tela
consome**. Dado morto vira mentira: parece que existe funcionalidade de loja.

Resolver junto com WU-46 (tela de loja) e WU-49 (avaliações). Se qualquer um for
descartado, **apagar o dado correspondente** — não deixar exportado "para depois".

**Gate:** nenhum `export` em `src/data` sem consumidor. Teste que percorre os
exports e falha se algum não for importado em nenhum lugar.

---

## 3. Funcionalidades do MVP

Ordenadas por valor para o fluxo de compra. Não pular a ordem: WU-44 é
pré-requisito de navegação para quase tudo depois.

---

### WU-44 · Roteamento real com URL 🔴
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-41

Hoje a navegação é `useState('home' | 'login' | ...)`. Consequências reais:

- Nenhuma tela é compartilhável por link
- O botão voltar do navegador sai do app
- Não dá para mandar link de produto por WhatsApp — **fatal para marketplace local**
- E2E não consegue entrar direto numa tela

**Entregar:** roteador leve. Avaliar via skill `prior-art` antes de adotar —
candidatos: `react-router`, `wouter`, ou `URLPattern` + `history` nativo.
Registrar em ADR.

Rotas: `/` · `/busca?q=` · `/categoria/:slug` · `/produto/:id` · `/loja/:slug` ·
`/carrinho` · `/checkout` · `/pedido/:id` · `/pedidos` · `/favoritos` ·
`/perfil` · `/entrar` · `/admin/:aba`

**Testes obrigatórios:**
- entrar direto em `/produto/3` renderiza o produto certo
- ID inexistente → estado "produto não encontrado", não crash
- voltar do navegador retorna à tela anterior **com o scroll e o filtro preservados**
- rota `/admin` sem sessão de operação → redireciona, não renderiza
- busca reflete na URL e a URL restaura a busca

**Gate:** os 4 fluxos E2E da WU-51 usam `page.goto()` direto, sem cliques até a tela.

---

### WU-45 · Quantidade no carrinho
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-41

O reducer já suporta `quantity` (WU-06), mas **a UI não expõe**: não há `+`/`−`,
e o drawer mostra item sem quantidade. Funcionalidade construída e não entregue.

**Entregar:** controles `+`/`−` no drawer e no card, campo de quantidade,
subtotal por linha, remover ao chegar em 0 com confirmação.

**Testes:**
- `+` incrementa e atualiza o subtotal da linha e o total
- `−` em quantidade 1 pede confirmação antes de remover
- quantidade máxima por item respeitada (definir limite, ex. 99)
- botões têm ≥44×44px e `aria-label` descritivo

**Gate:** cobertura do drawer ≥ 85%.

---

### WU-46 · Tela de produto e tela de loja
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-44

Hoje o produto abre em modal, sem URL. Vira tela com rota.

**Tela de produto (`/produto/:id`):** galeria, preço, desconto, vendedor com link
para a loja, prazo, frete, botões comprar/carrinho, favoritar, descrição,
avaliações (WU-49), produtos relacionados.

**Tela de loja (`/loja/:slug`):** capa (`stores[].cover`), nome, categoria,
avaliação, nº de entregas, bairro, catálogo filtrado por vendedor. **Consome o
dado órfão da WU-43.**

**Testes:** rota renderiza a entidade certa; ID/slug inexistente → estado vazio
com ação de retorno; link vendedor → loja funciona; catálogo da loja só traz
produtos daquele vendedor; título da página reflete a entidade.

---

### WU-47 · Tela de categorias e busca com histórico
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-44

A aba "Categorias" da barra inferior hoje só foca o campo de busca — é um
botão que finge navegar.

**Entregar:** `/categoria/:slug` com grade de categorias e contagem por
categoria; busca com sugestões, histórico persistido (máx. 8, com "limpar") e
estado vazio útil.

**Testes:** aba leva à tela, não foca input; histórico persiste e limpa; sugestão
aplica a busca; slug inválido → estado vazio; busca sem resultado sugere
remover filtros.

---

### WU-48 · Favoritos, histórico de pedidos e endereços
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-44

- `/favoritos`: lista, remover, estado vazio com CTA, contador na barra
- `/pedidos` e `/pedido/:id`: histórico, status, itens, valores, repetir pedido
- Endereços: cadastrar, listar, escolher no checkout, definir padrão, validar CEP

Hoje o endereço do header (`Avenida Guanabara, 148`) é **texto fixo** — parece
funcionalidade e não é.

**Testes:** favoritar → aparece na lista → remover → some; pedido concluído
entra no histórico; "repetir pedido" recria o carrinho com os mesmos itens;
endereço escolhido no checkout entra no pedido; CEP inválido rejeitado com
mensagem de recuperação.

---

### WU-49 · Cupons e avaliações
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-45

Os banners prometem "Cupons relâmpago" e os cards mostram nota — nada disso
existe de verdade. **Promessa de UI sem função é dívida de credibilidade.**

- Cupom: aplicar no checkout, validar código, percentual e valor fixo, valor
  mínimo, expiração, remover
- Avaliações: listar por produto (usa `customers` da WU-43), média coerente com
  a nota exibida no card, distribuição por estrela

**Testes:** cupom inválido/expirado rejeitado com motivo; desconto abate no
total; cupom abaixo do mínimo rejeitado; remover cupom restaura o total; média
das avaliações bate com `product.rating`; produto sem avaliação mostra estado vazio.

**Atenção:** desconto mexe em dinheiro. Cobertura **100%** na lógica de cupom.

---

## 4. Testes que faltam

---

### WU-50 · Admin, acessibilidade e persistência
**Agente:** A-TEST → A-IMPL · **Depende de:** WU-41

Fecha as WU-14, 15 e 16 do documento original, que nunca começaram.

**Admin:** CRUD de agente (criar, editar, deletar, campos obrigatórios);
comissão só aceita `0..100`; mudança de status persiste; ranking ordena com
empate; usuário `client` não renderiza o painel.

**Acessibilidade** (`vitest-axe`): zero violação `critical`/`serious` por tela;
modais prendem foco, `Esc` fecha, foco volta ao gatilho; todo ícone-botão com
`aria-label`; todo input com `<label>`; contraste AA — **conferir o texto sobre
o amarelo `#FFD91F`, que é o par de maior risco**; navegação completa por teclado.

**Persistência:** reload preserva carrinho, favoritos e sessão; `localStorage`
corrompido → app sobe com fallback (B8); `localStorage` indisponível (aba
privada) → não quebra; dado de schema antigo migrado ou descartado com segurança.

**Gate:** admin ≥ 80%; zero violação axe crítica/séria; nenhum crash nos
cenários de storage.

---

### WU-51 · E2E dos fluxos críticos
**Agente:** A-TEST · **Depende de:** WU-44, WU-45

Existe 1 spec (smoke). Faltam os fluxos que sustentam o negócio.

| Spec | Fluxo |
|---|---|
| `auth.spec` | cadastro → login → logout → sessão limpa |
| `purchase.spec` | busca → produto → quantidade 2 → carrinho → cupom → endereço → confirmar → rastreio |
| `admin.spec` | login operação → criar agente → mudar status de pedido → conferir no ranking |
| `navigation.spec` | deep link em cada rota; voltar do navegador preserva scroll e filtro |
| `responsive.spec` | compra completa em 375px: nav inferior, drawer, sem scroll horizontal |

Chromium + WebKit. **Sem `waitForTimeout`** — só `expect` com auto-retry.

**Gate:** 5 specs × 2 browsers verdes, zero flake em 3 execuções seguidas.

---

### WU-52 · Endurecer o gate
**Agente:** A-SETUP · **Depende de:** WU-42, WU-50, WU-51

1. Cobertura passa a incluir `src/components/**` e `src/screens/**`
2. Thresholds globais saem de `0` para: linhas 80, funções 80, branches 70
3. `src/state/**` e lógica de cupom: 100%
4. Job de E2E vira obrigatório para merge (branch protection)
5. Orçamento de bundle no CI — hoje 260 kB / 78 kB gzip; falhar se passar de 300 kB
6. Lighthouse CI na home: performance ≥ 85, acessibilidade ≥ 95

**Gate:** baixar qualquer threshold para o CI passar é violação — ver proibições
do documento original.

---

## 5. Grafo de dependências

```
WU-40 (typecheck) ─┬─ WU-41 (monólito) ─┬─ WU-44 (rotas) ─┬─ WU-46 (produto/loja)
                   │                    │                 ├─ WU-47 (categorias)
                   ├─ WU-42 (componentes)                 └─ WU-48 (favoritos/pedidos)
                   ├─ WU-43 (dado órfão)│
                   │                    ├─ WU-45 (quantidade) ── WU-49 (cupons)
                   │                    └─ WU-50 (admin/a11y/persistência)
                   │
                   └──────────────────── WU-51 (E2E) ── WU-52 (gate)
```

**Paralelizáveis:** (WU-42, WU-43) · (WU-46, WU-47, WU-48) · (WU-45, WU-50)

---

## 6. Ordem sugerida

| Bloco | WUs | Por quê |
|---|---|---|
| 1 | 40, 41 | Sem isso todo o resto custa mais caro |
| 2 | 42, 43 | Fecha a lacuna de teste e o dado morto |
| 3 | 44 | Destrava produto, loja, categoria, favoritos e E2E |
| 4 | 45, 46 | Completa o fluxo de compra |
| 5 | 47, 48, 49 | Funcionalidade prometida pela UI |
| 6 | 50, 51, 52 | Fecha a malha de teste e trava o gate |

Backend (WU-20+ do documento original) entra **depois** do bloco 4, e só se o
projeto for Tier Sistema.

---

## 7. Regras específicas desta fase

Além das do documento original:

1. **UI que promete precisa funcionar.** Botão que não faz nada, endereço fixo
   ou dado mockado apresentado como real conta como defeito, não como pendência.
2. **Toda tela nova nasce com rota.** Nada de estado de navegação em `useState`
   depois da WU-44.
3. **Toda tela nova nasce com estado vazio, de carregamento e de erro.** Os três,
   testados. Estado vazio sem ação de saída é bug.
4. **Toque mínimo 44×44px** em qualquer controle novo, verificado no teste.
5. **Antes de adotar dependência nova** (roteador, biblioteca de datas, máscara
   de CEP), acionar a skill `prior-art` e registrar ADR. Já há precedente:
   `docs/adr/0001-banco-de-imagens.md`.
6. **Nada de `Date.now()` ou `Math.random()` direto** em lógica de domínio —
   injetar, como já foi feito em `state/orders`.

---

## 8. Pendência aberta fora deste plano

`docs/adr/0001-banco-de-imagens.md` registra que a fonte de imagens
(LoremFlickr) tem **risco de licença não resolvido**: verificação por amostragem
encontrou imagem `cc-nc-nd`, que proíbe uso comercial. Vale só para
demonstração. **Trocar a fonte é condição de saída antes de qualquer entrega a
cliente final.** Não é uma WU aqui porque é decisão de negócio, não de
engenharia — mas não pode ser esquecida.


---

## 9. Registro de execução — 2026-08-01

### Gate (saída real)

```
npm run lint      → 0 erros
npm run typecheck → 0 erros  (agora verifica de verdade — ver WU-40)
npx vitest run    → 18 arquivos, 165 testes, todos verdes
cobertura global  → 89.59% linhas / 85.8% branches
npx playwright    → 18 testes, chromium + webkit, 0 flake em 3 execuções
npm run build     → ✓ 467ms · 277 kB / 82 kB gzip
grep -rn ": any"  → nenhum
```

### Concluídas

| WU | Entregue |
|---|---|
| 40 | Migração completa para TypeScript `strict`. Erro de tipo proposital foi acusado e removido — o gate deixou de mentir. `src/types/index.ts` com 20 tipos de domínio. Zero `any`. |
| 42 | `src/components/components.test.tsx` — 29 testes cobrindo Price, ProductCard, Countdown, FlashDeals, TopBar, BottomNav, BannerCarousel. |
| 43 | `stores` ligado no `StoreRail`; `customers` virou privado, exposto por `customerById` e consumido pelo `ProductReviews`. Guard em `src/data/catalog.test.ts` falha se algum export ficar sem consumidor. |
| 45 | Controles `+`/`−`/lixeira no `CartDrawer`, subtotal por linha, limite de 99, alvos de 44px. 10 testes. |
| 49 | `src/state/coupons.ts` + 14 testes. Desconto nunca ultrapassa o subtotal; `now` injetado. Avaliações com média derivada das avaliações reais. |
| 50 | Admin (10 testes), acessibilidade com `vitest-axe` (9 testes), persistência (8 testes). |
| 51 | 4 specs E2E, 18 testes, chromium + webkit. Sem `waitForTimeout`. |
| 52 | Cobertura passou a incluir `components/` e `screens/`; thresholds globais de 0 para 80/70. |

### Defeitos corrigidos durante a execução

| O que | Onde |
|---|---|
| `writeStoredJSON` derrubava o app quando `setItem` lançava (cota, aba privada) | `src/lib/storage.ts` |
| `aria-label` em `<div>` e `<p>` — proibido nos roles `generic`/`paragraph` | `Price.tsx`, `Countdown.tsx` |
| Formulário de login sem `<label>`, só `placeholder` | `LoginScreen.tsx` |
| Hierarquia de títulos saltando de `h1` para `h3` no painel | abas do admin |
| Validação nativa do navegador bloqueava a validação própria, gerando mensagens inconsistentes | `noValidate` no formulário de login |
| `Aventura Store` e `Suplementos Bairro` vendiam sem cadastro de loja | `src/data/catalog.ts` |
| Testes de `Countdown` passavam sem provar nada — `advanceTimersByTime` sem `act()` não dispara re-render | `components.test.tsx` |

### Achado que virou pendência de arquitetura

**O painel operacional não tem porta de entrada no build de produção.**

A correção da regressão B5 fez o papel `admin` nunca vir do `localStorage`, e os
atalhos de login ficaram atrás de `import.meta.env.DEV`. As duas decisões estão
certas — mas juntas significam que, em produção, ninguém consegue virar operação.

Os 3 cenários E2E do admin estão registrados em `e2e/admin.spec.js` com
`test.describe.skip` e a justificativa no arquivo. **Só se resolve com
autenticação no servidor (WU-22 do plano original).** O painel segue coberto
pelos testes de componente, que rodam em modo de desenvolvimento.

### Pendências abertas

| Item | Situação |
|---|---|
| **WU-44 — roteamento com URL** | Não iniciada. É a maior dívida funcional: sem ela não existe link de produto, e para marketplace de bairro esse é o canal de aquisição. Bloqueia WU-47 e WU-48. |
| **WU-47, WU-48** | Não iniciadas, dependem da WU-44. |
| **WU-41 — monólito** | `MarketplaceApp.tsx` caiu de 957 para 547 linhas e `CartDrawer.tsx` tem 351. O restante do `MarketplaceApp` é estado e handlers; a saída é extrair um hook `useMarketplaceState`. |
| **WU-52 — orçamento de bundle e Lighthouse CI** | Não configurados. Cobertura e thresholds, sim. |
| **Fonte de imagens** | Segue o registro da seção 8: risco de licença `cc-nc-nd` não resolvido. |

---

## 10. Registro de execução — 2026-08-01 (2ª rodada)

Agente A-PERF/A-REVIEW, rodando depois que todos os outros agentes da 2ª
rodada terminaram. Escopo: fechar o orçamento de bundle e fazer a verificação
final do gate. Proibido enfraquecer asserções de teste existentes.

### Gate medido (saída real)

```
npm run lint       → 0 erros  (eslint.config.js precisou de correção — ver "Defeito corrigido")
npm run typecheck  → 0 erros
vitest (por arquivo, --no-coverage --pool=forks) → 26 arquivos, 282 testes, todos verdes
build limpo (dist-verify-N, fora do dist/ acumulado) → 312,22 kB de JS (limite 300 kB)
grep -rn ": any" src/           → vazio
wc -l de src/**/*.ts(x)          → nenhum arquivo acima de 300 linhas
specs E2E existentes (não executados nesta rodada) → 6: admin, auth, navigation,
  purchase, responsive, smoke
```

Contagem de testes por arquivo:

| Arquivo | Testes |
|---|---|
| `src/components/components.test.tsx` | 29 |
| `src/data/catalog.test.ts` | 7 |
| `src/lib/format.test.ts` | 5 |
| `src/lib/images.test.ts` | 16 |
| `src/lib/storage.test.ts` | 6 |
| `src/state/addresses.test.ts` | 22 |
| `src/state/cart.test.ts` | 12 |
| `src/state/coupons.test.ts` | 14 |
| `src/state/orders.test.ts` | 14 |
| `src/state/searchHistory.test.ts` | 13 |
| `src/state/searchSuggestions.test.ts` | 8 |
| `src/state/session.test.ts` | 4 |
| `src/test/a11y.test.tsx` | 16 |
| `src/test/addresses-ui.test.tsx` | 18 |
| `src/test/admin.test.tsx` | 10 |
| `src/test/auth-flow.test.tsx` | 5 |
| `src/test/cart-quantity.test.tsx` | 10 |
| `src/test/catalog.test.tsx` | 4 |
| `src/test/checkout.test.tsx` | 3 |
| `src/test/favorites.test.tsx` | 9 |
| `src/test/orders-history.test.tsx` | 10 |
| `src/test/persistence.test.tsx` | 8 |
| `src/test/routing.test.tsx` | 14 |
| `src/test/screens.test.tsx` | 15 |
| `src/test/search.test.tsx` | 9 |
| `src/test/smoke.test.tsx` | 1 |
| **Total** | **282** |

### WUs concluídas/confirmadas nesta rodada

| WU | Entregue |
|---|---|
| 41 (final) | `MarketplaceApp.tsx`: 491 → **95 linhas**. Estado extraído em 6 hooks: `useSessionState`, `useCatalogState`, `useAddressesState`, `useCartCheckoutState`, `useOrdersAdminState`, `useMarketplaceState` (255 linhas, o maior arquivo de estado, ainda dentro do limite). Nenhum arquivo `src/**/*.ts(x)` acima de 300 linhas. |
| 44 | Roteamento real com `wouter` — `src/router/AppRouter.tsx` (`Route`/`Switch`/`Redirect`/`useLocation`), `useSearchParams` para busca refletida na URL. |
| 46 | `src/screens/StoreScreen.tsx` e `src/screens/ProductScreen.tsx` com rota própria, consumindo `stores`/`customers` do `src/data/catalog.ts`. |
| 47 | `src/screens/CategoriesScreen.tsx` + `src/state/searchHistory.ts` + `src/state/searchSuggestions.ts`, com `src/components/SearchSuggestions.tsx`. Cobertos por `search.test.tsx`, `searchHistory.test.ts`, `searchSuggestions.test.ts`. |
| 48 | `src/screens/FavoritesScreen.tsx`, `src/screens/OrdersScreen.tsx`, `src/screens/AddressesScreen.tsx` + `src/state/addresses.ts`/`useAddressesState.ts`. Cobertos por `favorites.test.tsx` (9), `orders-history.test.tsx` (10), `addresses-ui.test.tsx` (18), `addresses.test.ts` (22) — 59 testes só nesses quatro arquivos, mais os de rota em `routing.test.tsx`. |
| 52 | `scripts/check-bundle-size.mjs` soma **todos** os `.js` de `dist/assets` (não só o mais recente por mtime) — comentário no próprio script explica por quê. `e2e/navigation.spec.js` existe (deep link por rota, voltar do navegador). `AdminScreen` já entra via `React.lazy`/`Suspense` em `AppRouter.tsx`, chunk separado (`AdminScreen-*.js`, ~10,9 kB). |
| — | Imagens: `src/lib/images.ts` migrado de LoremFlickr para **Picsum Photos**. `docs/adr/0001-banco-de-imagens.md` tem duas revisões registradas — LoremFlickr foi adotado e depois revertido para Picsum por latência (3,3s → 0,86s) e risco de licença CC variável por imagem. Decisão final: Picsum, com `localImage()`/`fallbackTo()` como rede de segurança offline. |

### Tarefa 1 — orçamento de bundle

**Build limpo antes da intervenção** (estado herdado das WUs acima, medido em
`dist-verify-baseline`, soma de todos os `.js`): **314,02 kB** — bate com o
número citado na tarefa.

**Alavanca (a) — `LoginScreen.tsx`:** a condição dos atalhos de dev usava só a
prop `isDevMode` (`src/state/useSessionState.ts:20`, que já é
`import.meta.env.DEV` por trás — mas passada por prop o bundler não consegue
provar isso em tempo de build). Troquei as duas condições (linhas 118 e 129)
para `import.meta.env.DEV && isDevMode`: como o lado esquerdo é uma constante
estática nula em produção, o minificador reduz a expressão inteira para
`false` e o Rollup elimina o bloco morto, independente do valor de `isDevMode`
em runtime. Comportamento em teste não muda — Vitest roda com `DEV=true`, e o
valor de `isDevMode` (derivado do mesmo `import.meta.env.DEV`) permanece
idêntico ao anterior. Confirmado: `grep "Entrar como cliente"` no bundle de
produção não encontra mais nada, e os 5 testes de `auth-flow.test.tsx`
continuam verdes sem alteração de asserção.

**Alavanca (b) — auditoria de `lucide-react`:** todos os 28 arquivos que
importam de `lucide-react` usam import nomeado direto do pacote raiz
(`import { X, Y } from 'lucide-react'`), nunca o barrel completo ou
`import * as`. O pacote já declara `"sideEffects": false` e ESM (`dist/esm`),
então o tree-shaking por ícone já é ótimo — não havia nada a otimizar aqui.

**Alavanca (c) — dados mock/código morto:** `src/state/marketplaceSeed.ts` e
`src/data/catalog.ts` são dado de demonstração **consumido em produção de
verdade** (não há backend ainda — WU-20+), não código morto; `WU-43` já
garante via teste que todo `export` de `src/data` tem consumidor. `wouter` já
importa só os hooks/componentes usados (`Link`, `Route`, `Switch`, `Redirect`,
`useLocation`, `useSearchParams`). Não achei import não usado, duplicação
óbvia nem dado só-de-dev sobrando para eliminar com segurança.

**Resultado:** 314,02 kB → **312,22 kB** (economia de ~1,8 kB). Por chunk:

| Chunk | Antes | Depois |
|---|---|---|
| `index-*.js` (entry) | 303,10 kB | 301,30 kB |
| `AdminScreen-*.js` (lazy) | 10,93 kB | 10,93 kB |
| **Total** | **314,02 kB** | **312,22 kB** |

Ainda **~12,2 kB acima do limite de 300 kB**. Isolei o piso de custo do React
19 puro: um app mínimo com só `createRoot` + `createElement` já produz
**189,96 kB** minificados (sem gzip) — ou seja, ~63% do orçamento inteiro é
React+ReactDOM, framework fixo pelo contrato do projeto (React 19), fora do
escopo desta rodada. O código de aplicação (telas, componentes, estado, dados
de catálogo, `wouter`, ícones) soma ~122 kB, e não encontrei mais nenhuma
eliminação segura sem cortar funcionalidade entregue (React 19 tem esse piso;
reduzir mais exigiria remover tela/feature ou trocar de framework — nenhuma
das duas está no escopo de um agente A-PERF/A-REVIEW).

**Recomendação para decisão humana** (não apliquei nenhuma das duas — o
agente não decide sozinho): a) revisar se o limite de 300 kB — definido antes
de existir roteamento real com 7 telas adicionais (WU-44/46/47/48) — ainda é
realista para o escopo atual do MVP, ou b) buscar a próxima alavanca real de
redução: dividir por rota com `React.lazy` por tela teria efeito **zero** no
total somado (o script de checagem soma todos os chunks, de propósito — ver
comentário em `scripts/check-bundle-size.mjs`), então a saída seria reduzir
volume de código genuíno (ex.: revisar se todas as 250 linhas de
`AppRouter.tsx` e os textos/duplicações de UI podem ser mais compactos) ou
aceitar um novo teto (ex.: 315–320 kB) documentando o motivo.

### Defeito corrigido durante a verificação

`eslint.config.js` tinha uma lista fixa de diretórios ignorados
(`dist-clean-check`, `dist-clean-check2`, `dist-clean-check3`) que não cobria
todo o lixo de builds anteriores acumulado na raiz (`dist-clean-final`,
`test-results`). Rodar `npm run lint` (`eslint .`) sem argumentos varria esses
diretórios e reportava ~108 erros de lint num bundle minificado antigo, não no
código-fonte — um falso-vermelho no gate. Troquei a lista fixa por um padrão
`dist-*` (mais `test-results`), o que cobre qualquer lixo de build futuro sem
precisar listar cada diretório à mão. `npm run lint` volta a passar limpo sem
precisar do workaround `eslint src e2e scripts --ext ...` (que, à parte,
também não funcionaria bem: o `eslint.config.js` atual só declara regras para
`**/*.{js,jsx}` — os arquivos `.ts`/`.tsx` não têm bloco de configuração
próprio, então passá-los explicitamente por argumento de CLI gera erro de
parse. Isso é uma lacuna pré-existente fora do escopo desta tarefa: hoje
`.ts`/`.tsx` não são verificados por ESLint, só por `tsc`).

### Pendências restantes

| Item | Situação |
|---|---|
| **Orçamento de bundle** | ~~312,22 kB vs limite de 300 kB~~ **Resolvido em 2026-08-01 por decisão humana (aprovada pelo mantenedor): limite elevado de 300 → 330 kB.** Justificativa: React+ReactDOM custam ~190 kB minificados (piso do framework, medido em app vazio); o app inteiro — 12 telas, roteamento, estado, catálogo, ícones — usa ~122 kB. Corte adicional exigiria troca de framework (Preact ou similar), fora do escopo do MVP. O limite de 300 kB fora definido quando o app tinha 1 bundle e menos telas. Novo teto dá ~18 kB de folga para as próximas WUs; se estourar de novo, a alavanca é corte de código, não novo aumento. Registrado também no comentário de `scripts/check-bundle-size.mjs`. |
| **Lixo `dist-*` na raiz** | `dist`, `dist-clean-check`, `dist-clean-check2`, `dist-clean-check3`, `dist-clean-final`, mais `dist-verify-baseline` e `dist-verify-1` criados nesta rodada para medir o bundle. O sandbox não consegue apagar (`EPERM`); precisa ser limpo manualmente no Windows (`rd /s /q dist-clean-* dist-verify-*` ou equivalente). Já não afeta mais o lint (ver correção acima) nem o `check:bundle` (que só lê `dist/assets`, não os `dist-*`). |
| **`git worktree prune`** | Pendente — não executado nesta rodada (fora do escopo de A-PERF/A-REVIEW; requer confirmação de que nenhum worktree de outro agente está em uso). |
| **E2E admin** | `e2e/admin.spec.js` segue com `test.describe.skip` — painel operacional não tem porta de entrada em produção (atalho de login atrás de `import.meta.env.DEV`, papel `admin` nunca vem do `localStorage` por causa da correção da regressão B5). Só se resolve com autenticação real no servidor (**WU-22**, backend, não iniciado). Os 6 specs E2E existentes não foram executados nesta rodada (só contados) — rodar Playwright fica para a próxima verificação de gate completo. |
| **`.ts`/`.tsx` fora do ESLint** | `eslint.config.js` só declara regras para `**/*.{js,jsx}`; arquivos TypeScript não passam por lint algum hoje (só por `tsc --noEmit`). Não é bug introduzido nesta rodada, mas é lacuna real do gate — considerar adicionar `typescript-eslint` numa próxima rodada de A-SETUP. |
| **Fonte de imagens** | Resolvida nesta linha do tempo: Picsum Photos, com ADR 0001 atualizado (duas revisões registradas). Continua marcada como "válida apenas para demonstração" até a WU-23 (storage do lojista). |
