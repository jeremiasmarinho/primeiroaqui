# Espaços Publicitários na Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Espaços de anúncio vendáveis na home (carrossel, faixa destaque, patrocinados no feed), gerenciáveis pela aba admin, com fallback "Anuncie aqui".

**Architecture:** Modelo `AdPlacement` no Prisma; rota pública `GET /api/ads` (agrupada por slot, filtrada por vigência) + CRUD admin protegido; hook `useAds` no client; três superfícies na home com rotulagem "Patrocinado" obrigatória.

**Tech Stack:** Prisma 7 + Postgres (Supabase), Hono, zod v4, React 19 + Tailwind, Vitest + Testing Library.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-16-ad-placements-design.md` — ler antes de cada task.
- Comentários e copy em pt-BR, no estilo dos arquivos vizinhos (comentários explicam "porquê").
- Todo anúncio pago exibe selo "Patrocinado" ou "Publicidade" visível (CDC/CONAR).
- Links externos: `rel="noopener sponsored"`, `target="_blank"`.
- `npm run gate` (lint + typecheck + test:unit + build + bundle) deve passar ao final de cada task.
- Commits frequentes, mensagens em pt-BR estilo convencional (`feat:`, `test:` …) como no histórico.
- Rotas seguem o padrão de `src/server/routes/*.ts`: `new Hono<AuthEnv>()`, export nomeado `xxxRoutes`, registrado em `src/server/app.ts`.
- Testes de rota seguem o padrão dos vizinhos (`*.test.ts` ao lado, mockando prisma como os existentes fazem — LER um teste vizinho, ex. `notifications.test.ts`, antes de escrever).

---

### Task 1: Modelo AdPlacement (Prisma) + migration

**Files:**
- Modify: `prisma/schema.prisma` (adicionar enum + model ao final)
- Create: migration via CLI

**Interfaces:**
- Produces: `prisma.adPlacement` (client), enum `AdSlot = HERO_CAROUSEL | HIGHLIGHT_STRIP | SPONSORED_FEED`.

- [ ] **Step 1: Adicionar ao `prisma/schema.prisma`:**

```prisma
/// Onde o anúncio aparece na home. Cada slot tem contrato visual próprio.
enum AdSlot {
  HERO_CAROUSEL
  HIGHLIGHT_STRIP
  SPONSORED_FEED
}

/// Espaço publicitário vendido. Sem billing no sistema (venda combinada fora);
/// `advertiserName` é a rastreabilidade de quem pagou pelo espaço.
model AdPlacement {
  id             String   @id @default(cuid())
  slot           AdSlot
  advertiserName String
  imageUrl       String
  linkUrl        String?
  startsAt       DateTime
  endsAt         DateTime
  active         Boolean  @default(true)
  position       Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([slot, active, startsAt, endsAt])
}
```

- [ ] **Step 2:** `npx prisma migrate dev --name ad_placements` — esperado: migration criada e aplicada; `npx prisma generate` sem erro.
- [ ] **Step 3:** `npm run typecheck` — PASS.
- [ ] **Step 4:** Commit: `feat: modelo AdPlacement para espaços publicitários da home`

---

### Task 2: Rota pública GET /api/ads

**Files:**
- Create: `src/server/routes/ads.ts`
- Create: `src/server/routes/ads.test.ts`
- Modify: `src/server/app.ts` (import + `app.route('/', adRoutes)`)

**Interfaces:**
- Produces: `GET /api/ads` → `{ heroCarousel: Ad[], highlightStrip: Ad | null, sponsoredFeed: Ad[] }` onde `Ad = { id, slot, advertiserName, imageUrl, linkUrl, position }` (sem datas — o client não precisa). `adRoutes` exportado.
- Regras: só `active: true` e `startsAt <= now <= endsAt`; ordenado por `position asc`; `highlightStrip` = primeiro vigente do slot.

- [ ] **Step 1: Teste falhando** em `ads.test.ts` (seguir padrão de mock de `notifications.test.ts`): casos — (a) retorna vazio `{heroCarousel: [], highlightStrip: null, sponsoredFeed: []}` sem anúncios; (b) filtra expirado/agendado/inativo; (c) agrupa por slot e ordena por position; (d) highlightStrip pega o de menor position.
- [ ] **Step 2:** `npx vitest run src/server/routes/ads.test.ts` — FAIL (módulo não existe).
- [ ] **Step 3: Implementar `ads.ts`:**

```ts
import { Hono } from 'hono'
import { prisma } from '../lib/prismaClient'

export const adRoutes = new Hono()

/**
 * Anúncios vigentes da home, agrupados por slot. Público e sem dados de
 * vigência na resposta: o client só precisa saber o que exibir AGORA.
 */
adRoutes.get('/ads', async (c) => {
  const now = new Date()
  const ads = await prisma.adPlacement.findMany({
    where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { position: 'asc' },
    select: { id: true, slot: true, advertiserName: true, imageUrl: true, linkUrl: true, position: true },
  })
  return c.json({
    heroCarousel: ads.filter((a) => a.slot === 'HERO_CAROUSEL'),
    highlightStrip: ads.find((a) => a.slot === 'HIGHLIGHT_STRIP') ?? null,
    sponsoredFeed: ads.filter((a) => a.slot === 'SPONSORED_FEED'),
  })
})
```

- [ ] **Step 4:** Registrar em `app.ts`; rodar teste — PASS.
- [ ] **Step 5:** Commit: `feat: GET /api/ads — anúncios vigentes agrupados por slot`

---

### Task 3: CRUD admin de anúncios

**Files:**
- Modify: `src/server/routes/ads.ts` (acrescentar rotas admin)
- Modify: `src/server/routes/ads.test.ts`

**Interfaces:**
- Produces: `POST /api/admin/ads`, `PATCH /api/admin/ads/:id`, `DELETE /api/admin/ads/:id` — todos com `requireUser, requireAdmin` (de `../middleware/auth`). `GET /api/admin/ads` lista TODOS (inclusive inativos/expirados) ordenado por slot+position.
- Validação zod: `slot` enum; `advertiserName` min 2; `imageUrl` URL http(s) ou path `/...`; `linkUrl` opcional idem; `endsAt > startsAt` (refine); `position` int >= 0.

- [ ] **Step 1: Testes falhando:** 401 sem token; 403 não-admin; POST feliz cria e devolve 201; POST com `endsAt <= startsAt` → 400; PATCH altera `active`; DELETE remove; GET admin lista inativos.
- [ ] **Step 2:** Rodar — FAIL.
- [ ] **Step 3: Implementar** com `zod` (padrão dos vizinhos que validam body), usando `Hono<AuthEnv>` e `requireUser, requireAdmin`:

```ts
const adInput = z
  .object({
    slot: z.enum(['HERO_CAROUSEL', 'HIGHLIGHT_STRIP', 'SPONSORED_FEED']),
    advertiserName: z.string().trim().min(2),
    imageUrl: z.string().regex(/^(https?:\/\/|\/)\S+$/),
    linkUrl: z.string().regex(/^(https?:\/\/|\/)\S+$/).nullish(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    active: z.boolean().optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: 'endsAt deve ser após startsAt' })
```

PATCH usa `adInput.partial()` + refine só quando ambas as datas vierem.
- [ ] **Step 4:** Testes — PASS. `npm run gate` — PASS.
- [ ] **Step 5:** Commit: `feat: CRUD admin de anúncios com validação de vigência`

---

### Task 4: Client — tipos, fetchers e hook useAds

**Files:**
- Modify: `src/lib/api.ts`
- Create: `src/state/useAds.ts`
- Create: `src/state/useAds.test.ts`

**Interfaces:**
- Consumes: `GET /api/ads` da Task 2; CRUD da Task 3.
- Produces (em `api.ts`): `ApiAdSlot`, `ApiAd { id, slot, advertiserName, imageUrl, linkUrl, position }`, `ApiAdsResponse { heroCarousel: ApiAd[]; highlightStrip: ApiAd | null; sponsoredFeed: ApiAd[] }`, `fetchAds(): Promise<ApiAdsResponse>`, `adminListAds(token)`, `adminCreateAd(token, input)`, `adminUpdateAd(token, id, input)`, `adminDeleteAd(token, id)` — seguindo o padrão dos fetchers existentes em `api.ts` (mesmo tratamento de erro/base URL).
- Produces (hook): `useAds(): { ads: ApiAdsResponse; isLoading: boolean }` — estado inicial vazio (`{heroCarousel: [], highlightStrip: null, sponsoredFeed: []}`), fetch no mount, falha silenciosa (home nunca quebra por causa de anúncio — cai no fallback).

- [ ] **Step 1:** Teste do hook (padrão `useRemoteNotifications.test.ts`): sucesso popula, erro mantém vazio sem lançar.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** Commit: `feat: client de anúncios (fetchers + useAds)`

---

### Task 5: Faixa destaque (HighlightStrip) + fallback "Anuncie aqui"

**Files:**
- Create: `src/components/HighlightStrip.tsx`
- Create: `src/components/HighlightStrip.test.tsx`

**Interfaces:**
- Consumes: `ApiAd | null` via prop `ad`.
- Produces: `<HighlightStrip ad={ApiAd | null} />`.
- Comportamento: com `ad` → faixa fina (altura ~44px) com `imageUrl` de fundo ou nome do anunciante, selo "Publicidade" (texto visível, `text-micro`), link envolvente (`<a>`; externo = `target="_blank" rel="noopener sponsored"`; interno = `Link` do wouter). Sem `ad` → fallback: fundo neutro, texto "Anuncie aqui — sua marca para toda a cidade", CTA WhatsApp `https://wa.me/5500000000000?text=Quero%20anunciar%20no%20Primeiro%20Aqui` (constante `ADVERTISE_WHATSAPP_URL` exportada — número placeholder até o usuário fornecer o real).

- [ ] **Step 1:** Testes: renderiza anúncio com selo "Publicidade"; renderiza fallback sem ad; link externo tem `rel` correto.
- [ ] **Step 2:** FAIL → implementar (estilo Tailwind dos vizinhos: `rounded-card`, `shadow-card`, tokens `ink`/`brand`) → PASS.
- [ ] **Step 3:** Commit: `feat: faixa de destaque vendável com fallback Anuncie aqui`

---

### Task 6: BannerCarousel consome ads do slot HERO_CAROUSEL

**Files:**
- Modify: `src/components/BannerCarousel.tsx`
- Modify: `src/components/components.test.tsx` (ou teste próprio se os vizinhos fizerem assim)

**Interfaces:**
- Consumes: `ApiAd[]` via prop nova `ads?: ApiAd[]`.
- Produces: `<BannerCarousel ads={ApiAd[]} />` — mantém export default e o comportamento atual (scroll-snap, sem autoplay, bolinhas, IntersectionObserver).
- Comportamento: com `ads.length > 0` → slides são os anúncios: `<img src={imageUrl} alt={advertiserName}>` cobrindo o card + selo "Patrocinado" no canto (`text-micro`, fundo semitransparente), clicável via linkUrl (mesma regra de link da Task 5). Com `ads` vazio/ausente → mantém os banners estáticos atuais de `data/catalog` (eles viram o "fallback institucional" do carrossel). NÃO remover os banners estáticos.

- [ ] **Step 1:** Testes: com ads renderiza imagem + selo "Patrocinado"; sem ads renderiza banners estáticos (comportamento atual preservado).
- [ ] **Step 2:** FAIL → implementar → PASS. Acessibilidade preservada (`aria-label` com advertiserName).
- [ ] **Step 3:** Commit: `feat: carrossel da home aceita banners patrocinados`

---

### Task 7: Cards patrocinados no feed da home

**Files:**
- Create: `src/components/SponsoredCard.tsx` + `src/components/SponsoredCard.test.tsx`
- Modify: `src/screens/HomeScreen.tsx`
- Modify: `src/MarketplaceApp.tsx` (chamar `useAds()` e passar props — localizar onde `HomeScreen` é renderizado e seguir o padrão de props existente)

**Interfaces:**
- Consumes: `useAds()` da Task 4; `HighlightStrip` (Task 5); `BannerCarousel ads` (Task 6).
- Produces: `<SponsoredCard ad={ApiAd} />` — card no formato do grid (mesmo footprint do `ProductCard`): imagem, advertiserName, selo "Patrocinado" sempre visível, link. `HomeScreen` ganha prop `ads: ApiAdsResponse` e: passa `ads.heroCarousel` ao carrossel, renderiza `<HighlightStrip ad={ads.highlightStrip} />` logo abaixo do carrossel, e intercala `SponsoredCard` no grid a cada 8 produtos (`sponsoredFeed[i % sponsoredFeed.length]`, nenhum card se o slot estiver vazio — no feed o fallback "Anuncie aqui" NÃO aparece para não poluir o grid).

- [ ] **Step 1:** Testes: SponsoredCard exibe selo; HomeScreen com sponsoredFeed insere card após o 8º produto; sem ads o grid fica idêntico ao atual.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** `npm run gate` — PASS.
- [ ] **Step 4:** Commit: `feat: home com faixa destaque e patrocinados no feed`

---

### Task 8: Aba "Anúncios" no admin

**Files:**
- Create: `src/screens/admin/AdminAdsTab.tsx` + `src/screens/admin/AdminAdsTab.test.tsx`
- Modify: `src/screens/admin/AdminScreen.tsx` (tipo `AdminTab` ganha `'ads'`, `TAB_LABELS.ads = 'Anúncios'`, render da aba)
- Modify: `src/state/useAdminDashboard.ts` OU hook novo `src/state/useAdminAds.ts` (preferir hook novo, focado — seguir estilo de `useAdminDashboard`)

**Interfaces:**
- Consumes: `adminListAds/adminCreateAd/adminUpdateAd/adminDeleteAd` da Task 4.
- Produces: aba com: lista agrupada por slot mostrando advertiserName, vigência e status derivado (Ativo = vigente+active; Agendado = startsAt futura; Expirado = endsAt passada; Inativo = active false); formulário criar/editar (campos do modelo; slot como select com rótulos "Carrossel do topo" / "Faixa de destaque" / "Patrocinado no feed"; datas `input type="datetime-local"`; preview `<img>` da imageUrl); botão Desativar/Reativar (PATCH active). Sem botão de delete na UI.

- [ ] **Step 1:** Testes (padrão dos testes de tab vizinhos): lista renderiza status derivado correto para os 4 casos; submit do form chama create com payload certo; desativar chama update `{active: false}`.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** `npm run gate` — PASS.
- [ ] **Step 4:** Commit: `feat: aba Anúncios no painel admin`

---

### Task 9: Seed de demonstração + verificação final

**Files:**
- Modify: `prisma/seed.ts` (2 anúncios de exemplo por slot, vigência de 90 dias, imageUrl apontando para fotos já usadas no seed)
- Modify: `docs/superpowers/specs/2026-08-16-ad-placements-design.md` (marcar status: implementado)

- [ ] **Step 1:** Seed idempotente no padrão do arquivo (ler antes; usar upsert/deleteMany como os vizinhos fazem).
- [ ] **Step 2:** `npm run gate` completo — PASS. `npm run test:e2e` se o ambiente permitir (não bloqueante se depender de DB indisponível — reportar).
- [ ] **Step 3:** Commit: `feat: seed de anúncios de demonstração`
