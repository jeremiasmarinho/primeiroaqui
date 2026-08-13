# Item 14 — Opção de retirada do pedido na loja

## Contexto

Hoje todo pedido exige um endereço de entrega (`Order.addressId` obrigatório,
`POST /orders` recusa sem ele). Não existe alternativa a "receber em casa" —
mesmo lojas físicas que aceitariam o cliente ir buscar o produto não têm essa
opção no checkout. Este design adiciona retirada na loja como alternativa à
entrega, opt-in por loja.

## Objetivo

- Lojista habilita/desabilita retirada por loja (`Store.pickupAvailable`,
  mesmo padrão de `Store.giftWrapAvailable`).
- No checkout, cada loja do carrinho que oferece retirada mostra a opção
  "Retirar na loja" como alternativa a "Entregar" — a escolha é por loja,
  não para o carrinho inteiro (carrinho multi-loja já vira 1 `Order` por
  loja; a escolha de entrega/retirada acompanha essa divisão natural).
- Pedido com retirada não exige endereço de entrega.
- Cliente vê o endereço da loja para saber onde retirar — o que exige
  adicionar campos de endereço à `Store`, que hoje só tem lat/lng.
- Status final do pedido continua sendo `DELIVERED` no banco; a UI troca o
  rótulo para "Retirado" quando `isPickup=true`. Sem mudança na máquina de
  estados (`src/lib/orderStatus.ts`).

## Fora de escopo (YAGNI)

- Notificação de "pedido pronto para retirada" — a infra do fluxo de
  notificações (`createNotification`) já suporta isso trivialmente, mas não
  foi pedido; fica para um pedido futuro explícito.
- Taxa de entrega — não existe hoje (confirmado: nenhum campo de frete no
  código atual), não é introduzida aqui.
- Múltiplos endereços/horários de retirada por loja (ex.: "retire na filial
  X ou Y") — uma loja, um endereço.
- Validação de horário de funcionamento da loja no momento da retirada.

## Modelo de dados

```prisma
model Store {
  // ...campos existentes...

  /** Endereço físico da loja — usado para exibir "retire em: ..." quando pickupAvailable. */
  street       String?
  number       String?
  complement   String?
  neighborhood String?
  city         String?
  state        String?
  zipCode      String?

  /** Loja aceita retirada presencial do pedido. */
  pickupAvailable Boolean @default(false)
}

model Order {
  // ...campos existentes...

  /** Pedido é retirado na loja em vez de entregue — addressId fica nulo quando true. */
  isPickup  Boolean  @default(false)
  addressId String?  // era obrigatório; agora opcional
  address   Address? @relation(fields: [addressId], references: [id])
}
```

Migration real via `prisma migrate dev` (schema-to-schema diff, mesmo método
usado na Task 1 do fluxo de notificações — ver aquele design/plano para o
racional de por que essa abordagem evita o drift-check do `migrate dev`
contra o banco real de dev, que hoje ainda carrega tabelas órfãs não
rastreadas).

Os campos de endereço da `Store` são todos opcionais (`String?`) — uma loja
sem `pickupAvailable=true` não precisa deles preenchidos. Quando o lojista
liga `pickupAvailable`, o formulário de cadastro exige os campos de
endereço (validação no cliente e no servidor).

## Backend

### `POST /stores` e `PATCH /stores/:id` (`src/server/routes/stores.ts`)

Aceitam os novos campos de endereço e `pickupAvailable` no body, mesmo
padrão de `giftWrapAvailable` hoje. Validação: se `pickupAvailable=true`,
`street`/`city`/`state`/`zipCode` são obrigatórios (400 se ausentes) — não
faz sentido habilitar retirada sem endereço.

### `POST /orders` (`src/server/routes/orders.ts`)

- `addressId` no schema Zod vira opcional.
- Novo campo no body: `pickupStoreIds: string[]` (ids das lojas do carrinho
  para as quais o cliente escolheu retirada — o restante usa entrega).
- Ao montar `itemsByStore` (já existe, agrupa por loja), para cada loja em
  `pickupStoreIds`: validar que `store.pickupAvailable === true` (400 se
  não — não deixar forçar retirada numa loja que não oferece), criar o
  `Order` daquela loja com `isPickup: true`, `addressId: null`.
- Para lojas fora de `pickupStoreIds`: comportamento atual, exige
  `addressId` válido do usuário.
- Se o carrinho tem ao menos uma loja SEM pickup e `addressId` não foi
  informado: 400 (mesmo erro de hoje, "endereço obrigatório").

## Frontend

### Checkout (`src/components/cart/`)

- `CartItemsStep.tsx`: itens passam a ser agrupados por `product.storeId`
  (usar `seller`/`storeId` já presentes em `Product`), cada grupo com o
  nome da loja como cabeçalho — mudança de layout, não de dados (o dado já
  existe no item).
- Novo componente `DeliveryOrPickupToggle.tsx` (por seção de loja, só
  renderizado se `store.pickupAvailable` — o catálogo carregado já traz
  `giftWrapAvailable` por produto/loja hoje, `pickupAvailable` segue o
  mesmo caminho de dados).
- `DeliveryFields.tsx` (endereço compartilhado) só aparece/é obrigatório se
  pelo menos uma loja do carrinho está em modo "Entregar".
- `useCartCheckoutState.ts`: novo estado `pickupByStoreId: Record<string,
  boolean>`, incluído no payload de `POST /orders` como `pickupStoreIds`
  (lojas com `true`).

### Exibição de pedidos

- `src/lib/orderStatus.ts`: `orderStatusLabel` não muda (independe de
  pickup) — o rótulo "Retirado" é aplicado na camada de exibição
  (`OrdersScreen`, `OrderDetailScreen`, `TrackingScreen`, painel de pedidos
  do lojista), não na função central de status, checando
  `order.isPickup && order.status === 'DELIVERED'` no ponto de exibição.
- Onde hoje mostra o endereço de entrega, se `isPickup`: mostra "Retirar
  em: {endereço formatado da loja}" em vez do endereço do comprador.

### Cadastro da loja

- `BusinessSetupState`/tela "Minha loja": novos campos de endereço +
  toggle de retirada, mesmo formulário onde `giftWrapAvailable` é editado
  hoje.

## Testes

- Unit: `stores.ts` — criar/editar loja com `pickupAvailable=true` exige
  endereço; sem isso, 400.
- Unit: `orders.ts` — checkout com `pickupStoreIds` cria `Order` com
  `isPickup=true`/`addressId=null` só para as lojas listadas; erro 400 se
  uma loja em `pickupStoreIds` não tem `pickupAvailable`; erro 400 se
  sobra loja sem endereço e sem pickup.
- Unit: label "Retirado" aparece corretamente na função/componente de
  exibição de status quando `isPickup`.
- E2E: fluxo completo — lojista habilita retirada com endereço, cliente
  monta carrinho com produtos dessa loja, escolhe "Retirar na loja" no
  checkout, finaliza sem preencher endereço, pedido aparece com "Retirar
  em: ..." tanto para o comprador quanto no painel do lojista.
