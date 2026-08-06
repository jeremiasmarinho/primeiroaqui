# Pesquisa — Integração de entregas (gate de prior-art)

**Data:** 03/08/2026 · **Contexto:** pedido de "orquestrar as entregas com a API do 99" para o Primeiro Aqui (marketplace hiperlocal, Araguaína/TO).

Tudo abaixo foi verificado em fonte primária, navegando nos sites oficiais — não é memória nem suposição.

## 1. A API do 99 não serve para o objetivo declarado

**Fonte:** `https://developer-food.99app.com/pt-BR/home` (lida no navegador; a página é SPA e não renderiza via fetch simples).

O portal é a **"99Food Open Platform"** — integração para **restaurantes venderem dentro do app 99Food**, no mesmo modelo do iFood para parceiros. Evidências na própria página:

- Parceiros técnicos listados são sistemas de PDV/gestão de restaurante: Saipos, Sischef, Cardápio Web, Menu Integrado, Garçom Web, PickNGo, etc.
- Fluxo de onboarding em 6 etapas ("Certificação e aplicativo → App de teste → Depuração → Teste e aceitação → Serviço de autorização → Garantia de serviço online") é o de virar loja parceira.
- Texto de valor: "Conecte-se à enorme base de usuários de estabelecimentos e clientes da 99Food", "Item de menu completo, integração de API de pedidos".

**Conclusão:** não há, nessa plataforma, um modo "só despacho de entregador" desacoplado de virar parceiro do marketplace deles. O objetivo declarado pelo usuário — *"quero só o entregador, não virar parceiro do app deles"* — não é atendido por essa API.

## 2. Open Delivery é o caminho correto — e é real

**Fontes:** `https://opendelivery.com.br/sobre/` e `https://abrasel-nacional.github.io/docs/`.

- Padrão aberto coordenado pela **Abrasel**, iniciado em jan/2021, gratuito e open source (Apache 2.0).
- Resolve explicitamente a dor "falta de integração com a logística e recebimento da rastreabilidade do entregador".
- Padrões de "chamada e rastreabilidade do entregador" liberados em nov/2021; primeira operação real de delivery no padrão em abr/2022.

### Correções ao briefing recebido
| Afirmação do briefing | Realidade verificada |
|---|---|
| Versão estável é **v1.4.0** | Versão atual é **v1.7.0** (changelog de 05/01/2026). v1.4.0 existe, mas é antiga. |
| — | **Não existe ambiente de produção centralizado.** O Open Delivery não hospeda API nenhuma: "Open Delivery does not have a server or baseURL". Há sandbox (`developer.opendelivery.com.br`), e cada empresa hospeda os próprios endpoints. |

### Endpoints do módulo LOGISTICS (v1.7.0)

Quem implementa cada rota está marcado na tabela oficial "How to Start". Para o Primeiro Aqui, que seria o **Ordering Application** (a plataforma onde o consumidor faz o pedido):

**Que *nós chamamos* no Operador Logístico:**
| Endpoint | Função |
|---|---|
| `POST /logistics/availability` | Cotação: disponibilidade e preço da entrega |
| `POST /logistics/delivery` | Cria a solicitação de entrega |
| `GET /logistics/delivery/{orderId}` | Detalhes e histórico da entrega |
| `POST /logistics/cancel/{orderId}` | Cancela a entrega |
| `POST /logistics/readyForPickup/{orderId}` | Avisa que o pedido está pronto para coleta |
| `POST /logistics/orderPicked/{orderId}` | Confirma coleta |
| `POST /logistics/finishDelivery/{orderId}` | Finaliza |
| `POST /logistics/handleProblem/{orderId}` | Reporta problema |

**Que *nós expomos* para o Operador Logístico chamar de volta:**
| Endpoint | Função |
|---|---|
| `POST /deliveryUpdate` (webhook) | Atualização de status / rastreamento |
| `POST /logistics/confirmationCode` (webhook) | Código de confirmação de entrega |

**Autenticação:** OAuth2 `client_credentials` via `POST /oauth/token`. Detalhe crítico do padrão: **as credenciais são geradas POR MERCHANT**, não por plataforma — ou seja, cada loja do marketplace teria seu próprio `clientId`/`clientSecret` junto ao operador logístico.

## 3. O pré-requisito que bloqueia tudo (e já está resolvido)

Implementar o padrão **não conecta a nenhum entregador**. A documentação é explícita: *"Once your system or platform is compliant to the standard, you will be able to integrate with other companies also compliant to the standard."* É preciso um operador logístico aderente, com contrato comercial, atendendo Araguaína.

**Fonte:** Vitrine de Aderentes (`https://aderentes.opendelivery.com.br/companies/search?type=Operador Logístico`).

Existem **5 operadores logísticos aderentes**, todos com selo "Padrão de Logística — Pronto para Integrar / Verificado":

| Empresa | Sandbox | Eventos | Observação |
|---|---|---|---|
| **Machine Tecnologia de entrega** | Sim | Webhook | "maior infraestrutura para mobilidade e entregas **regional** do país"; contato `parcerias@machine.global`; AppId público `6151cc5a-9f31-4491-8763-b42b0c9314c2` |
| Logical Delivery | Sim | Webhook | "conecta comércios a entregadores autônomos" |
| Pick n Go | Sim | Webhook | software de gestão logística |
| Ayo Entregas | — | Webhook | logística de alta performance |
| Foody Delivery | Sim | Polling | logística urbana |

**Machine é a candidata mais promissora** pelo foco declarado em cobertura *regional* (não só capitais) — mas **cobertura em Araguaína/TO não está documentada em lugar nenhum**. Isso é conversa comercial, não pesquisa técnica.

## 4. Recomendação

**Não escrever código de integração antes de confirmar cobertura em Araguaína com pelo menos um operador.** O risco é literal: integração perfeita, zero entregador disponível.

Ordem sugerida:
1. **Contato comercial** (usuário) — e-mail para `parcerias@machine.global` e aos demais, perguntando: (a) atendem Araguaína/TO? (b) qual o modelo de contrato para marketplace, não restaurante? (c) acesso ao sandbox.
2. **Só depois**, desenhar e implementar a integração — com camada de abstração de provedor, já que o padrão é o mesmo para os 5 e trocar de operador vira configuração, não reescrita.

Enquanto isso, o sistema de agentes internos (Fase 10) continua sendo o caminho operacional.

## 5. Nota sobre o sistema de agentes atual

O "sistema de agentes" existente (Fase 10) é apenas um **cadastro administrativo** — nome, região, especialidade, comissão, status — sem despacho real, sem geolocalização, sem rastreamento. Não é uma solução de logística; é um registro de quem são os entregadores. Substituí-lo por Open Delivery é troca de "cadastro manual" por "despacho automatizado de verdade", não troca de dois sistemas equivalentes.
