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

## Gap conhecido: servidor ainda não tem build/empacotamento de produção

`start:server` roda `tsx src/server/index.ts` — ou seja, executa o
TypeScript-fonte direto via `tsx`, uma ferramenta de desenvolvimento (não
transpila para um artefato de produção nem empacota o servidor). Isso
funciona hoje porque o servidor só roda localmente/neste ambiente de
desenvolvimento, mas é um gap para quando o projeto for containerizado de
verdade: um `Dockerfile` que rode `npm ci --omit=dev && npm run start:server`
ainda dependeria de `tsx` (hoje em `devDependencies`, corretamente, pois é
ferramenta de build/dev) para rodar em produção, o que não faz sentido para
uma imagem de produção enxuta.

Quando a containerização real for tratada (Fase 8/9 ou uma tarefa de deploy
dedicada), resolver isso com um passo de build explícito (ex.: compilar
`src/server` para `dist/server` com `tsc`/`esbuild`/`tsup` e rodar
`node dist/server/index.js` em produção) antes de gerar a imagem Docker. Não
é necessário resolver agora — apenas registrado como débito conhecido.
