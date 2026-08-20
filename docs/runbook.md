# Runbook — Operação e Manutenção

## Migrações Prisma — Atenção ao Drift

### Por quê este aviso?

O banco de dados Supabase deste projeto gerencia automaticamente suas próprias extensões PostgreSQL (`supabase_vault`, `pg_stat_statements`, `uuid-ossp`, entre outras). Essas extensões **não fazem parte do histórico de migrations do Prisma** — elas existem no schema `public` do banco real, mas não aparecem em `prisma/migrations/`.

Quando você roda `npx prisma migrate dev`, o Prisma verifica se o estado atual do banco (schema) corresponde ao que ele espera com base nas migrations. Como essas extensões geridas pelo Supabase estão presentes no banco real mas ausentes no histórico de migrations, o Prisma detecta esse estado como **drift** (divergência do histórico).

### O risco: Reset destrutivo

Quando o Prisma detecta drift, ele **pedirá para resetar o schema `public`** com um prompt interativo:

```
Prisma has detected that the database schema is not in sync with the migrations history.
Would you like to reset the schema? This is destructive.
```

Se você aceitar (`yes`, `y`, ou confirmar o prompt), o Prisma vai **APAGAR todos os dados da tabela `public`** e reconstruir a partir do zero com base nas migrations. **Isso é irrecuperável em um ambiente de produção.**

### Como proceder: O fluxo correto

**NUNCA rode `npx prisma migrate dev` neste projeto sem antes ler qualquer mensagem de prompt que ele mostrar.**

O fluxo correto para aplicar novas migrações é:

1. **Gere o SQL sem aplicar:**
   ```bash
   npx prisma migrate diff \
     --from-config-datasource \
     --to-schema prisma/schema.prisma \
     --script > /tmp/migration.sql
   ```
   Isso gera o SQL que será executado, sem tocar no banco.

2. **Revise o SQL gerado:**
   Abra o arquivo `/tmp/migration.sql` (ou onde você salvou) e leia cada comando DDL. Certifique-se de que:
   - Não há `DROP TABLE` nem `DROP SCHEMA` inesperados.
   - Todas as colunas, índices e restrições fazem sentido.
   - Não vai afetar extensões geridas pelo Supabase.

3. **Coloque manualmente em `prisma/migrations/`:**
   ```bash
   mkdir -p prisma/migrations/<TIMESTAMP>_<NOME>
   ```
   Crie um arquivo `migration.sql` dentro desse diretório com o SQL revisat. O timestamp deve ser um número Unix crescente (ex.: `20260802120000`).

4. **Aplique com `migrate deploy`:**
   ```bash
   npx prisma migrate deploy
   ```
   Este comando roda o SQL real contra o banco **sem passar por nenhum prompt interativo de reset**. É seguro porque você já revisou o SQL.

5. **Sincronize o Prisma Client:**
   ```bash
   npx prisma generate
   ```

### Se acidentalmente disser `yes` a um reset

**Você não pode desfazer.** Todos os dados em `public` foram apagados. Se isso acontecer em produção:

1. Restaure o backup mais recente do banco (se tiver).
2. Não toque em nada até falar com o arquiteto de dados.

### Resumo

- `migrate dev` = **NUNCA rode sem ler prompts** (risco de reset destrutivo).
- `migrate diff ... --script` = Gere o SQL para revisar.
- `migrate deploy` = Aplique o SQL já revisado (seguro, sem prompts).
- `generate` = Sincronize o Prisma Client após qualquer mudança no schema.

## `.env.local` nunca deve definir `NODE_ENV`

O Vite (usado pelo frontend) carrega `.env`/`.env.local` e, se essas variáveis
incluírem `NODE_ENV`, ele **sobrescreve** o modo real do comando — inclusive
em `vite build` (produção). Um `.env.local` com `NODE_ENV=development`
(colocado ali por engano na Fase 0 deste playbook de backend) fez `npm run
build` gerar um bundle de `react-dom` em modo desenvolvimento, quase
dobrando o tamanho (313 KB → 553 KB) sem nenhum erro visível — só o
`check:bundle` acusa, e só se alguém rodar o gate completo depois de tocar
no `.env.local`.

- **Nunca** adicione `NODE_ENV=` a `.env.local` ou `.env.example` neste
  projeto. O Vite já infere o modo certo sozinho (`dev` no servidor de
  desenvolvimento, `production` em `vite build`).
- Se o bundle disparar de tamanho sem motivo aparente depois de editar
  `.env.local`, confira primeiro se uma linha `NODE_ENV=` foi reintroduzida
  ali antes de investigar código.

## Deploy

**Fluxo vigente (desde 20/08/2026): Docker Compose + Caddy, descrito em
`docs/deploy-aws.md`.** Provisionamento com `scripts/provision-vps.sh`, deploy
com `scripts/deploy.sh` (preflight de `.env`, build, health gate, rollback
automático). O fluxo antigo de `docker build` + `docker run` manual da VPS
Hostinger está **superado** — registro histórico no fim deste arquivo. Não
misture os dois: um container avulso `primeiroaqui` na 3333 coexiste com a
stack do compose sem erro visível, e o Caddy passa a apontar para o container
errado.

O app roda como **um único container Node** que serve a API e a SPA já
buildada. Mesma origem: o front chama `/api/...` relativo, sem CORS e sem
`VITE_API_URL`. Nada de recurso proprietário de plataforma — a mesma imagem
sobe em qualquer VPS.

Arquivos que compõem o deploy: `Dockerfile`, `.dockerignore`, `compose.yml`,
`deploy/Caddyfile`, `scripts/deploy.sh`, `scripts/provision-vps.sh`,
`src/server/root.ts` (composição API + estáticos + fallback de SPA).

### Variáveis de ambiente na VPS

As env vars de produção vivem em `/opt/primeiroaqui/.env` (permissão `0600`,
fora do git — o `.dockerignore` bloqueia `.env*` de entrar na imagem) e são
lidas pelo compose (`env_file`). Referência de nomes:
`.env.production.example` — inclui `DOMAIN` e `ACME_EMAIL`, consumidas pelo
Caddy.

| Variável | Observação |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `3333` |
| `DATABASE_URL` | pooler do Supabase, **modo transaction** (porta 6543) |
| `DIRECT_URL` | conexão de sessão (porta 5432), usada só por migrations |
| `SUPABASE_URL` | |
| `SUPABASE_ANON_KEY` | |
| `SUPABASE_SERVICE_ROLE` | secret |
| `PAGARME_SECRET_KEY` | `sk_test_` até o go-live de pagamento real |
| `PAGARME_PUBLIC_KEY` / `PAGARME_ACCOUNT_ID` / `PAGARME_PLATFORM_RECIPIENT_ID` | ver `.env.production.example` |
| `PAGARME_WEBHOOK_SECRET` | **obrigatório** — sem ele o webhook aceita qualquer payload |
| `GOOGLE_PAY_GATEWAY_MERCHANT_ID` / `GOOGLE_PAY_ENV` | `TEST` até o merchant ser aprovado |

Se o container subir e morrer com `DATABASE_URL ausente`, é variável faltando
no `.env` da VPS, não bug de código.

### Migrations: passo humano, nunca no CMD

O container **não** roda `prisma migrate deploy` no boot. Migration é
operação potencialmente destrutiva e exige confirmação humana. O banco é
Supabase (acessível pela internet), então aplica-se da máquina de dev, com
`DIRECT_URL` de produção no ambiente, **antes** de promover a nova imagem:

```bash
npx prisma migrate deploy
```

Conferir antes com `npx prisma migrate status` e a seção de drift no topo
deste runbook.

### Ordem de um deploy

1. `npm run gate` local (lint + typecheck + testes + build + bundle).
2. `npx prisma migrate deploy` se houver migration nova.
3. Push em `main` → na VPS:
   `ssh <usuario>@<ip> "cd /opt/primeiroaqui && ./scripts/deploy.sh"`.
4. Verificar `https://<dominio>/api/health` → `{"status":"ok"}` e uma rota
   funda da SPA (ex.: `/produto/1`) devolvendo o app, não 404.

### Por que `tsx` está em `dependencies`

O servidor roda `npx tsx src/server/index.ts` em produção — sem passo de
compilação separado para `src/server`. É uma escolha deliberada: um único
caminho de build, sem um segundo `tsconfig`/bundler para manter em sincronia
com o do front. O custo é `tsx` viajar na imagem e o transpile acontecer no
boot (uma vez, ~centenas de ms). Se o boot virar gargalo, o caminho é
compilar `src/server` com `tsc`/`tsup` e trocar o `CMD` — nada mais no
deploy muda.

## PENDÊNCIA DE SEGURANÇA — rotação de credenciais (IMEDIATA)

**Status: PENDENTE. Fazer AGORA, antes de qualquer outro passo de deploy.**

Durante as sessões de deploy (ago/2026), a service-role key do Supabase e a
senha do banco foram exibidas em terminal de sessão de IA (transcrições e
logs de contexto). A rotação foi adiada sob a premissa de que o repo era
privado — **premissa falsa: constatou-se em 20/08/2026 que o repositório é
PÚBLICO**. Não há mais justificativa para adiar. Nenhum segredo real foi
versionado no git (auditado nos 134 commits em 20/08/2026; só templates),
mas este runbook expunha usuário SSH e IP da VPS, removidos na mesma data.

Rotacionar derruba qualquer instância que ainda use a senha velha — e o
Supabase não dá sobreposição de credencial (senha de banco é uma só;
rotacionar a service-role invalida a chave antiga na hora). Se rotacionar com
a VPS antiga ainda servindo 100% do tráfego e esperar o DNS propagar, a
janela de indisponibilidade é a propagação inteira. **Decisão (20/08/2026):
rotacionar e atualizar os DOIS `.env` na mesma janela** — a credencial já
esteve exposta, então encurtar a exposição vale mais que os segundos de
restart. Ordem: VPS nova provisionada e pronta → rotacionar → senha nova nos
dois `.env` → restart nos dois lados → validar os dois → virar o DNS. O
outage cai para o tempo de restart da VPS antiga (segundos), não para a
propagação de DNS.

Checklist de rotação (nesta ordem):

1. Pré-condição: VPS nova provisionada, clonada e com `.env` preenchido
   (exceto os valores que vão rotacionar).
2. Supabase → Settings → Database: resetar a senha do banco.
3. Supabase → Settings → API: rotacionar a service-role key.
4. Gravar os valores novos nos `.env` das DUAS VPS via scp ou nano direto na
   VPS (nunca colar segredo em chat): `DATABASE_URL`, `DIRECT_URL`,
   `SUPABASE_SERVICE_ROLE`.
5. VPS antiga: restart do container (fluxo histórico: `docker restart
   primeiroaqui`). VPS nova: `cd /opt/primeiroaqui && ./scripts/deploy.sh`.
6. Validar `/api/health` → 200 + um fluxo autenticado (login) nos dois hosts.
7. Virar o DNS (ver `docs/deploy-aws.md` §5).
5. Apagar o `.env.production` local antigo (contém a senha velha) ou
   regravá-lo com os valores novos.

A `SUPABASE_ANON_KEY` não precisa rotacionar (é pública por design, RLS é a
proteção).

## Acesso ao servidor (pós-hardening de 08/08/2026)

- SSH: **somente chave**, usuário `<usuario>@<ip-da-vps>` (sudo sem senha,
  grupo docker). Root e senha estão DESABILITADOS no sshd. Usuário e IP reais
  ficam no gerenciador de senhas — **nunca neste arquivo** (repo público).
- fail2ban ativo (jail sshd) e unattended-upgrades ligado.
- Deploy: `ssh <usuario>@<ip> "cd /opt/primeiroaqui && ./scripts/deploy.sh"`.
- Monitor de uptime: primario deve ser EXTERNO (UptimeRobot/Better Stack —
  configurar ANTES do cutover de DNS; ~3 min, tier free). Fallback é o
  workflow `uptime.yml` (1x/hora; falha = e-mail ao dono do repo), com dois
  limites: schedules são desativados após 60 dias sem atividade no repo, e
  em repo privado consomem cota de Actions.

## Registro histórico — fluxo Hostinger manual (SUPERADO em 20/08/2026)

Até 20/08/2026 a VPS Hostinger rodava sem compose: proxy reverso na máquina e
deploy manual com `git pull && docker build -t primeiro-aqui:latest . &&
docker rm -f primeiroaqui && docker run -d --name primeiroaqui --restart
unless-stopped -p 127.0.0.1:3333:3333 --env-file /opt/primeiroaqui/.env
primeiro-aqui:latest` (não havia Coolify; verificado em 15/08/2026). Este
fluxo NÃO deve mais ser usado — fica registrado só para entender o estado da
VPS antiga durante os 7 dias de janela de rollback do cutover.

## Pendências conhecidas (registradas em 15/08/2026)

- **Geocoding de endereços:** endereços são criados com `latitude/longitude`
  em `(0,0)` (sem geocoding no front) e o `PATCH /addresses/:id` não atualiza
  coordenadas. A busca por raio ignora endereços em `(0,0)` de propósito.
  Resolver na fase de descoberta (geocoding server-side no create/update).
- **Busca de lojas server-side:** a normalização de acentos na busca de LOJAS
  só existe no cliente; o endpoint de listagem de lojas não usa
  `unaccent`/trigram como o de produtos.
- **Apple Pay:** adiado pós-lançamento (exige conta Apple Developer, merchant
  registrado e validação de domínio). Google Pay está integrado.

## Drift resolvido em 15/08/2026 (registro)

O banco de produção tinha 5 migrations fantasmas de branches antigas
(`agents_and_schedule`, `coupons`, `add_store_phone_category`,
`notifications_and_threads`, `store_isactive_default_false`) e a
`add_notifications` falhou no meio (`NotificationType already exists`).
Correção aplicada: `scripts/prod-fix-drift.sql` (somente aditivo) +
`prisma migrate resolve --applied` nas duas migrations. Sobras que FICARAM
no banco para uma janela de limpeza futura: tabelas `agents`, `coupons`,
`schedule_items`, `threads`, `thread_messages`; colunas `stores.phone`,
`orders.couponCode`, `orders.discountCents`. Nada disso é lido pelo app.
`scripts/migrate-prod.mjs` é o utilitário (status|deploy|diff|exec|resolve-applied).
