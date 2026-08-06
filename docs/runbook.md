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

## Deploy — VPS Hostinger via Coolify

O app roda como **um único container Node** que serve a API e a SPA já
buildada. Mesma origem: o front chama `/api/...` relativo, sem CORS e sem
`VITE_API_URL`. Nada de recurso proprietário de plataforma — a mesma imagem
sobe em qualquer VPS.

Arquivos que compõem o deploy: `Dockerfile`, `.dockerignore`,
`src/server/root.ts` (composição API + estáticos + fallback de SPA).

### Pré-requisitos na VPS

1. Coolify instalado na VPS Hostinger.
2. Domínio do cliente apontando (registro A) para o IP da VPS. O Traefik do
   Coolify emite o certificado Let's Encrypt sozinho — **não** adicionar
   Caddy/Nginx próprio, os dois brigariam pelas portas 80/443.

### Configurar o recurso no Coolify

- **Build Pack:** Dockerfile.
- **Port Exposes:** `3333`.
- **Health Check Path:** `/api/health`.
- Variáveis de ambiente (aba Environment Variables — nunca em arquivo no
  repositório; ver `.env.production.example`):

| Variável | Observação |
| --- | --- |
| `NODE_ENV` | `production` — precisa vir daqui, não de arquivo (ver seção do `NODE_ENV` acima) |
| `PORT` | `3333` |
| `DATABASE_URL` | pooler do Supabase, **modo transaction** (porta 6543) |
| `DIRECT_URL` | conexão de sessão (porta 5432), usada só por migrations |
| `SUPABASE_URL` | |
| `SUPABASE_ANON_KEY` | |
| `SUPABASE_SERVICE_ROLE` | marcar como secret/oculta no painel |

Nenhum `.env` entra na imagem — o `.dockerignore` bloqueia `.env*`. Se o
container subir e morrer com `DATABASE_URL ausente`, é variável não
cadastrada no painel, não bug de código.

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
3. Push na branch acompanhada pelo Coolify → build e troca do container.
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
