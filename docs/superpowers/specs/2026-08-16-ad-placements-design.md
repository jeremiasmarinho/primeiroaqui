# Espaços publicitários vendáveis na home — Design

**Data:** 2026-08-16 · **Status:** implementado (2026-08-16)

## Objetivo
Monetizar a home do Primeiro Aqui com espaços de anúncio gerenciáveis pelo admin
(sem deploy para trocar anúncio), ajudando a pagar os custos do projeto.
Referência visual: home do Mercado Livre (carrossel de banners + faixa de assinatura).

## Fora de escopo (YAGNI)
- Cobrança/faturamento no sistema (venda combinada fora; `advertiserName` rastreia).
- Métricas de impressão/clique.
- Self-service para anunciantes.

## Dados (Prisma)
```prisma
enum AdSlot {
  HERO_CAROUSEL   // carrossel de banners no topo
  HIGHLIGHT_STRIP // faixa fina de destaque (estilo meli+), 1 ativo por vez
  SPONSORED_FEED  // cards "Patrocinado" intercalados no feed
}

model AdPlacement {
  id             String   @id @default(cuid())
  slot           AdSlot
  advertiserName String
  imageUrl       String
  linkUrl        String?  // rota interna (/loja/x) ou URL externa https
  startsAt       DateTime
  endsAt         DateTime
  active         Boolean  @default(true)
  position       Int      @default(0) // ordem dentro do slot
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

## API (Hono, padrão das rotas existentes)
- `GET /api/ads` — público. Retorna apenas `active && startsAt <= now <= endsAt`,
  agrupado por slot: `{ heroCarousel: Ad[], highlightStrip: Ad | null, sponsoredFeed: Ad[] }`.
  `highlightStrip` retorna o de menor `position` se houver mais de um vigente.
- `POST /api/admin/ads`, `PATCH /api/admin/ads/:id`, `DELETE /api/admin/ads/:id` —
  middleware ADMIN existente; validação com zod (URL https ou rota interna; endsAt > startsAt).
- Imagem: campo `imageUrl` (URL de imagem já hospedada — ex. Supabase Storage). Upload
  dedicado no admin fica para depois, se a fricção incomodar (YAGNI).

## Admin
Nova aba "Anúncios" no `AdminScreen`, seguindo o padrão das abas existentes:
lista agrupada por slot com status derivado (ativo / agendado / expirado / inativo),
formulário criar/editar com preview da imagem, ação desativar. Sem delete físico na UI
(desativar basta; DELETE existe na API para limpeza).

## Home
Três espaços, todos com fallback institucional "Anuncie aqui — sua marca para toda a
cidade" (CTA WhatsApp) quando o slot está vazio:
1. **Carrossel topo** — `BannerCarousel` existente passa a consumir `heroCarousel`.
2. **Faixa destaque** — componente novo `HighlightStrip` abaixo do carrossel.
3. **Patrocinados** — card com selo visível "Patrocinado" a cada ~8 produtos do grid.

Rotulagem "Patrocinado"/"Publicidade" visível em todo anúncio pago (CDC/CONAR — obrigatório).
Links externos abrem com `rel="noopener sponsored"`.

## Testes
- Unit: filtro de vigência e agrupamento por slot; validação zod.
- Rotas: autorização ADMIN (401/403), CRUD feliz e inválido.
- Componentes: fallback vs anúncio real; selo "Patrocinado" presente.
- Gate: `npm run gate` (lint + typecheck + unit + build + bundle) precisa passar.
