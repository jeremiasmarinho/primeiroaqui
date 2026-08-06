# Plano de Orquestração — Lançamento do MVP Primeiro Aqui

> Tier Sistema (dinâmico, infra gerenciada, recorrente) — exige Deploy via Coolify/VPS e Operação (monitor, analytics, backup) antes de abrir pra usuário real, conforme o contrato do projeto.

## Onde estamos de verdade

Backend completo e testado (24 fases: schema, auth, loja/produto/busca/fotos, favoritos/endereços/checkout multi-loja, dashboards, observabilidade, agentes/cupons/notificações, e o frontend inteiro religado à API real). Tudo commitado e empurrado para `origin/feat/backend-mvp`. **Nada disso está em produção.** Roda hoje só localmente (`npm run dev` + `npm run start:server`), contra um único Supabase usado também pelos testes.

## Decisões já travadas (não reabrir)

1. **Pagamento real entra no lançamento.** Checkout precisa cobrar de verdade (Stripe) — não lança sem isso.
2. **Precisa de tela de auto-cadastro de loja.** Não dá pra depender de cadastro manual via script no lançamento.
3. **Banco de produção e banco de teste vão ser separados** antes de lançar — dois projetos Supabase, não um.

Essas três decisões são o que mais expande o escopo em relação ao que já foi construído: nenhuma delas foi coberta nas 24 fases anteriores (foram corte de escopo deliberado até agora).

---

## Ordem de execução (P0 → P2)

### P0 — bloqueadores reais de lançamento (sem isso, não abre pra ninguém)

**P0.1 — Separar infraestrutura de produção e teste — ✅ CONCLUÍDO**
- Projeto Supabase de produção criado (`tzigphrmihtlivxjjnxi`, `sa-east-1`), separado do projeto de teste/dev (`wiklgakzarkxchrsxjpj`, usado em `.env.local`).
- 5 migrations aplicadas com sucesso via `prisma migrate deploy` (extensões `pg_trgm`/`unaccent`/`postgis`/`pgcrypto`/`citext` já vêm na própria migração inicial, não precisou de passo manual de SQL Editor).
- Confirmado: banco de produção limpo (0 produtos/lojas/usuários).
- Credenciais em `.env.production` (gitignored), com nota sobre `NODE_ENV` (nunca definir, mesmo bug documentado no runbook) e uma pendência menor: a connection string de pooler (`DATABASE_URL`, modo transaction) não foi confirmada — está usando a conexão direta como fallback temporário, funcional mas sem pooling de conexão. Confirmar a string real de pooler no painel (Database → Connect → Connection pooling) antes do deploy de produção de verdade, para não esgotar conexões sob carga.

~~Original~~ (histórico, já resolvido):
- Criar um segundo projeto Supabase (região `sa-east-1`, mesmas 5 extensões: `pg_trgm`, `unaccent`, `postgis`, `pgcrypto`, `citext`) dedicado a CI/desenvolvimento.
- Rodar as migrations nos dois projetos (`migrate deploy`, fluxo seguro já documentado em `docs/runbook.md`).
- `.env.local`/CI apontam pro projeto de TESTE. Um `.env.production` (nunca commitado) aponta pro projeto de PRODUÇÃO.
- Confirmar que `npm run db:seed` só roda no projeto de teste (ou, se rodar em produção pra popular as primeiras lojas reais, que os dados sejam de verdade — não os 8 produtos de demonstração).
- **Sem isso, os próximos passos rodam contra o banco errado por engano — é a base de tudo.**

**P0.2 — Deploy real do backend + frontend**
- Tentativa de preview rápido na Vercel (2026-08-03, a pedido do usuário, escopo explicitamente limitado a demonstração — destino final de produção continua Coolify/VPS): frontend subiu e serve normal; a função serverless do backend (Hono via `hono/vercel`) chegou a compilar e executar depois de resolver 4 problemas reais (builder da Vercel quebrando com o TypeScript 7 beta do projeto ao processar `.ts` em `/api`, incompatibilidade ESM/CJS do `@prisma/client` — corrigida gerando um bundle CJS via esbuild —, binário nativo do `sharp` ausente para `linux-x64`, e `prisma generate` que nunca rodava no install remoto). Esse último achado é real e válido para qualquer alvo de deploy: **`"postinstall": "prisma generate"` foi adicionado ao `package.json` (commit `11bc2a9`)** — sem isso, qualquer install limpo (CI, Docker, qualquer VPS) deixa `.prisma/client` ausente e quebra em runtime. Parado num timeout de conexão ao Postgres (`SELECT 1` do `/health` trava 5min) que não foi diagnosticado — a mesma `DATABASE_URL` funciona localmente o tempo todo, então cheira a algo de rede/TLS específico do ambiente serverless da Vercel. Artefatos específicos da Vercel (`vercel.json` com rewrites de API, `api/index.js` bundlado, `api/package.json`) foram descartados de propósito, não commitados — não fazem sentido no destino final (Coolify/VPS).
- Backend (Hono): hoje só roda via `tsx` (ferramenta de dev, não empacotamento de produção — já documentado como débito em `docs/runbook.md`). Precisa de um passo de build real (`tsc`/`esbuild`/`tsup` compilando `src/server` para JS) + `Dockerfile` (não existe ainda) + deploy via Coolify/VPS (domínio do cliente, HTTPS).
- Frontend: já builda estático (Vite) e já tem `vercel.json` — só precisa apontar `VITE_API_URL` pro domínio real do backend em produção.
- CORS: hoje é allowlist fixa de desenvolvimento (`localhost`) com um `TODO(producao)` já marcado no código (`src/server/app.ts`) — trocar pela allowlist real de produção (domínio do cliente) via env var.
- Variáveis de ambiente de produção completas: `DATABASE_URL`/`DIRECT_URL` (projeto de produção), `SUPABASE_*` (projeto de produção), `AUTH_RATE_LIMIT_MAX` (**não definir** — deixar cair no default de produção, 10/min), `TRUST_PROXY=1` (o VPS/Coolify normalmente fica atrás de um proxy reverso — sem isso o rate-limit vira global, bug já documentado e corrigido no código, só precisa ser ligado).

**P0.3 — Modelo de papel do dono de loja**
Bloqueador técnico para P0.4 e P0.5: hoje o frontend só distingue `client`/`admin` — um `STORE_OWNER` de verdade cai no mesmo balde de `admin` (decisão da Fase 15B). Antes de construir uma tela de "minha loja" de verdade, decidir:
- `Role` do frontend vira 3 valores (`client | store_owner | admin`), com uma view própria pro dono de loja (só vê/edita a própria loja e produtos, não o painel operacional inteiro).
- Essa é uma decisão de produto que eu preciso que você bata antes de eu sequenciar essa fase em detalhe — o quanto o dono de loja deveria ver do que hoje só admin vê (pedidos da própria loja, por exemplo, provavelmente sim).

**P0.4 — Auto-cadastro de loja (self-signup) — ✅ CONCLUÍDO**
- P0.4a (backend): `POST /stores` promove `BUYER`→`STORE_OWNER` transacionalmente, loja nasce `isActive: false` (moderação manual). `PATCH /stores/:id/approve` e `GET /admin/stores` admin-only. Achado corrigido na revisão: `POST /orders` não checava `store.isActive` — produto de loja pendente ainda podia ser comprado direto, furando a moderação pela borda de escrita.
- P0.4b (frontend): tela "Seja um parceiro" (`/seja-parceiro`) chamando `POST /stores` com coordenadas fixas de fallback (sem geocodificação real, limitação conhecida do MVP). Painel "Minha Loja" completo: estado "aguardando aprovação" enquanto pendente; depois de aprovada, CRUD de produto + upload de foto (reaproveitando os endpoints já testados) + lista de pedidos da própria loja (read-only — mudança de status continua exclusiva do admin). Um dono gerencia só a própria loja (decisão de produto travada, sem seletor multi-loja).
- Revisão adversarial (opus) encontrou 2 Critical: comentário falso alegando cobertura de upload de foto que não existia, e um checkbox do brief (E2E fim-a-fim cadastro→pendente→aprovação→painel) sem teste algum. Corrigido com um novo spec E2E real (`e2e/my-store.spec.js`, navegador real, backend real, upload de foto de verdade via `public/logo.png`).
- Efeito colateral real descoberto durante a correção: o primeiro rascunho do E2E reusava o usuário-fixture compartilhado `cliente@primeiroaqui.com` para o auto-cadastro, promovendo-o permanentemente a `STORE_OWNER` no banco de dev e quebrando outros testes que assumem esse usuário como `client` comum. Corrigido criando uma fixture dedicada (`parceiro-e2e@primeiroaqui.com`) só para este E2E, isolada das demais.

**P0.5 — Pagamento real (Stripe)**
Maior peça nova. Ordem sugerida:
1. **Gate de prior-art** (regra do seu CLAUDE.md): usar o SDK oficial do Stripe, nunca reimplementar nada de pagamento. Registrar em ADR.
2. Schema novo: `Payment` (ou campo em `Order`) vinculando `Order` a uma Stripe Checkout Session/Payment Intent, com status (`pending`, `paid`, `failed`, `refunded`).
3. Fluxo: hoje `POST /orders` cria o(s) `Order`(s) direto em `PENDING` sem gate de pagamento. Isso precisa mudar — o pedido só deveria avançar de "criado" para "confirmado" depois do pagamento confirmado. Decisão técnica: criar o `Order` já com o checkout (reserva o estoque, como já funciona) e o pagamento acontece em seguida via redirect pro Stripe Checkout, confirmado por **webhook** (nunca confie só no retorno de URL do navegador — webhook é a fonte de verdade).
4. Webhook do Stripe: rota nova, valida assinatura do Stripe, atualiza o `Order` correspondente.
5. Reversão: se o pagamento falhar/expirar, o pedido precisa ser cancelado automaticamente (reaproveita o `PATCH /orders/:id/status` → `CANCELED`, que já devolve o estoque — Fase 15G1).
6. **Testar exaustivamente em modo sandbox do Stripe antes de qualquer teste com dinheiro real** — isso é literalmente a regra do seu CLAUDE.md ("confirmação humana antes de... operação com dinheiro").

### P1 — antes de abrir pra usuários reais em escala (pode lançar em beta fechado sem isso, mas não pra público)

- **Operação**: backup do Postgres confirmado (plano do Supabase cobre isso? confirmar), monitoramento externo simples do `/health` (ex. UptimeRobot/Better Uptime — algo que avisa VOCÊ se o site cair, não só um endpoint que existe), rotação de log.
- **Correlação de tracing real**: o OpenTelemetry hoje sobe sem erro mas não gera spans de requisição HTTP corretos (hook ESM não registra sob `tsx` — débito já documentado na Fase 8). Sem isso, debugar um problema em produção é bem mais lento. Vale resolver antes de ter usuários reais gerando volume.
- **eslint cobrindo `.ts`/`.tsx`** (hoje só `.js`/`.jsx`) e `noUnusedLocals` no `tsconfig` — débito de gate conhecido desde a Fase 3, mencionado várias vezes ao longo da sessão. Barato de resolver, evita código morto se acumulando.
- **Enumeração de conta** (`POST /auth/signup` revela se um e-mail já existe) e **enumeração de cupom** (`POST /coupons/validate` sem rate limit) — riscos reais mas baixos, registrados nas revisões de segurança ao longo da sessão. Vale mitigar antes de escala, não bloqueia um beta fechado.

### P2 — pós-lançamento, primeiras semanas

- Correlação de conversão/analytics de produto (Plausible, GA, ou equivalente — decisão separada de qual ferramenta).
- Ampliar rate-limit para store compartilhado (Redis/Upstash) se e quando o backend rodar em mais de uma instância — hoje é in-memory single-instance, documentado, aceitável até lá.
- Resolver o gap de correlação de span do OTel de forma definitiva (se P1 só aplicar um paliativo).
- Reavaliar a lacuna de nomes de produto/loja ausentes no histórico de pedido (dívida técnica registrada na Fase 15F).

---

## Como eu sugiro orquestrar a execução

Mesmo padrão desta sessão (brief por sub-tarefa → subagente implementador → revisão adversarial → fix → próxima), mas com uma trava a mais dado que P0.5 mexe com dinheiro real: **nenhuma chamada real ao Stripe em modo produção acontece sem sua confirmação explícita, mesmo em teste** — sandbox primeiro, sempre.

Ordem sugerida de execução, cada item abaixo é o tamanho aproximado de uma "fase" como as que já rodamos:
1. P0.1 (separar bancos) — mecânico, rápido, sem ambiguidade.
2. P0.2 (deploy backend+frontend) — precisa de você para credenciais de Coolify/VPS/domínio; eu preparo Dockerfile/build, mas não tenho como criar a infra de servidor sozinho.
3. P0.3 (decisão de role) — decisão de produto primeiro (uma pergunta rápida), depois é técnico.
4. P0.4 (auto-cadastro de loja) — maior peça de frontend+backend nova.
5. P0.5 (Stripe) — maior peça de todas, e a que exige mais cuidado por mexer com dinheiro.
6. P1 — pode rodar em paralelo com o beta fechado, não bloqueia abrir pra um grupo pequeno e curado de usuários reais.

**Antes de eu começar a sequenciar P0.1 em detalhe**: confirma que quer que eu já comece a executar (mesmo ritmo de subagentes desta sessão), ou prefere primeiro decidir a moderação de loja (P0.4) e a divisão de view do dono de loja (P0.3) com mais calma antes de eu montar os briefs.
