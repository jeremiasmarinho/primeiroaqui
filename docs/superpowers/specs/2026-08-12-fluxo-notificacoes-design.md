# Fluxo de notificações — persistência no banco + notificação de novo pedido

## Contexto

Hoje o painel de notificações (`NotificationsPanel.tsx`) é 100% client-side: o
hook `useCatalogState.ts` guarda a lista em `useState` + `localStorage`
(`STORAGE_KEYS.notifications`), e `useMarketplaceState.ts` chama
`catalog.addNotification(...)` diretamente no código de UI sempre que uma ação
do próprio usuário termina (compra confirmada, loja criada, pagamento
aprovado) ou falha (favoritar deu erro, cadastro de loja deu erro).

Duas consequências problemáticas:

1. **Não sobrevive a troca de dispositivo/navegador** — é só `localStorage`.
2. **Não existe notificação de um usuário para outro** — o lojista nunca fica
   sabendo que um cliente comprou algo, a menos que ele mesmo abra "Meus
   pedidos" e repare.

Durante uma investigação de banco (2026-08-12) foi encontrada uma tabela
`notifications` órfã no Postgres de dev, sem correspondência em
`prisma/schema.prisma` nem em nenhuma migration versionada — provavelmente
criada manualmente fora do fluxo do Prisma. Este design substitui essa tabela
por uma versão oficial, versionada, e implementa o fluxo de verdade por trás
dela.

## Objetivo

- Persistir notificações no Postgres (model Prisma real), com endpoint
  paginado de leitura e um endpoint de "marcar como lidas".
- Cobrir a lacuna real que não existe hoje: **o dono da loja recebe uma
  notificação quando um cliente faz um pedido nela**.
- Manter o comprador recebendo notificação de pedido confirmado e de
  pagamento aprovado — mas agora originadas no servidor, não inventadas no
  cliente.

## Fora de escopo (YAGNI)

- Notificação de mudança de status de pedido, de review recebida, ou
  qualquer outro evento não pedido explicitamente.
- Push notification nativo (browser Notification API / mobile push) — fica
  para uma fase futura, se for pedido.
- Realtime (WebSocket/Supabase Realtime) — polling simples resolve o caso de
  uso atual sem nova infra.
- Erros transitórios de UI (ex.: "não foi possível favoritar") **não** viram
  notificação persistida — continuam como `pushToast` apenas, pois são
  feedback imediato de uma tentativa, não um evento de negócio que faça
  sentido reencontrar depois.

## Modelo de dados

```prisma
enum NotificationType {
  INFO
  SUCCESS
  WARNING
}

model Notification {
  id        String            @id @default(uuid())
  userId    String
  user      User              @relation(fields: [userId], references: [id])
  title     String
  message   String
  type      NotificationType  @default(INFO)
  href      String?
  isRead    Boolean           @default(false)
  createdAt DateTime          @default(now())

  @@index([userId, createdAt])
}
```

Migration real via `npx prisma migrate dev --name add_notifications`. Como
parte da mesma migration (ou de uma migration de limpeza separada, à critério
de quem implementar), a tabela `notifications` órfã existente no banco de dev
é dropada e recriada pela migration oficial — ela nunca teve dado real de
produção (achado da investigação anterior).

## Backend

### Helper central

`src/server/lib/notifications.ts`

```ts
export async function createNotification(userId: string, input: {
  title: string
  message: string
  type?: NotificationType   // default INFO
  href?: string
}): Promise<void>
```

Uma função só, chamada diretamente onde o evento acontece — sem event bus.
Falha ao criar notificação **não** deve derrubar a operação principal (pedido
continua criado mesmo se a notificação falhar): envolver a chamada em
try/catch com log, nunca propagar erro para quem criou o pedido/loja.

### Pontos de disparo

- **`POST /api/orders`** (`orders.ts`): depois de criar o(s) pedido(s) (um
  por loja, no caso de carrinho multi-loja):
  - notifica o **comprador**: título "Pedido confirmado", type `SUCCESS`,
    href para `/pedidos`.
  - notifica o **dono de cada loja** envolvida: título "Novo pedido
    recebido", mensagem com valor total do pedido daquela loja, type `INFO`,
    href para a tela de pedidos do lojista.
- **`POST /api/stores`** (`stores.ts`): notifica o dono recém-criado: "Loja
  criada", type `SUCCESS`, href para `/minha-loja`.
- **Pagamento confirmado** (`payments.ts`, quando o status do pedido muda
  para `PAID`): notifica o comprador, type `SUCCESS`, href para `/pedidos`.

### Rotas novas

- `GET /api/me/notifications?cursor=&limit=` — paginado, mais recentes
  primeiro, autenticado (usuário só vê as próprias). Retorna também
  `unreadCount`.
- `POST /api/me/notifications/read` — marca todas as notificações do usuário
  autenticado como lidas (`isRead = true`). Idempotente, sem payload.

## Frontend

- `useMarketplaceState.ts`: remove as chamadas a `catalog.addNotification`
  nos casos de **sucesso** que agora são responsabilidade do servidor
  (compra confirmada, loja criada, pagamento confirmado — ver
  `handleFinalizePurchase`, `finishCheckoutAfterPayment`,
  `handleBusinessSetupSubmit`). Os `pushToast` correspondentes continuam
  (feedback imediato não depende do round-trip de polling).
- Casos de **erro** (`notifyFavoriteError`, erro de cadastro de lojista, erro
  de criação de loja) passam a ser **toast-only**: `pushToast` continua
  disparando normalmente, mas a chamada a `catalog.addNotification` é
  removida — erro transitório de UI não entra mais no sino de notificações,
  só no toast (que já é o feedback imediato da tentativa). Isso simplifica o
  sino para ser 100% espelho do que está no banco, sem lista local paralela.
- `useCatalogState.ts`: `notifications`/`unreadCount` passam a vir de um novo
  hook (`useRemoteNotifications.ts`, no padrão de `useRemoteCatalog.ts`) que
  faz polling de `GET /api/me/notifications` a cada 30s + refetch ao
  `visibilitychange` (aba volta ao foco) + refetch imediato ao montar.
  `markNotificationsRead` chama `POST /api/me/notifications/read` e
  atualiza o estado local otimisticamente.
- `NotificationsPanel.tsx`: sem mudança de layout/props — só troca a fonte
  dos dados.

## Testes

- Unit: `src/server/lib/notifications.test.ts` (helper cria registro correto,
  não lança se a criação falhar internamente — mockar erro do Prisma).
- Unit: `orders.test.ts` / `stores.test.ts` / `payments.test.ts` — adicionar
  asserção de que a notificação certa foi criada para o(s) usuário(s)
  certo(s) após a ação.
- Unit: novas rotas `me/notifications` (listar paginado, marcar como lida,
  isolamento entre usuários — usuário A nunca vê notificação de usuário B).
- E2E: em `e2e/jornada-lojista.spec.ts`, depois do fluxo de compra rodado em
  `jornada-cliente.spec.ts` (ou dentro do mesmo spec, se mais simples),
  verificar que o lojista dono da loja comprada vê a notificação de novo
  pedido no painel.
