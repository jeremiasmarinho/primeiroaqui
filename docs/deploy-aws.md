# Deploy na AWS — Lightsail / EC2 (Docker Compose)

Complemento operacional do `docs/runbook.md`. O runbook continua sendo a fonte
de verdade sobre **migrations, variaveis e ordem de deploy**. Este documento
cobre só o que muda ao trocar a VPS Hostinger por uma instancia AWS.

---

## 0. Contexto — o que ja existe

| Item | Estado hoje |
| --- | --- |
| Aplicacao | Container Node unico: API Hono + SPA Vite na mesma origem, porta `3333` |
| Banco | **Supabase gerenciado**, fora da VPS. A VPS nao guarda estado. |
| Storage de imagens | Supabase Storage — tambem fora da VPS |
| Producao atual | VPS Hostinger, `docker run` manual + proxy reverso, dominio `primeiroaqui.koraforce.com.br` |
| Migrations | Passo humano, da maquina de dev, **antes** de promover a imagem |

A consequencia arquitetural mais importante: **a VPS e descartavel**. Não há
volume de dados, não há backup de banco a preservar, não há sessao em memoria.
Trocar de provedor é recriar um servidor de aplicacao stateless e virar o DNS —
não é uma migracao de dados.

---

## 1. Dimensionamento — qual instancia

O gargalo desta stack não é o runtime; é o **build**. `npm ci` + `vite build` +
`prisma generate` passam de 1 GB de pico. Em uma maquina de 1 GB o build morre
com `Killed` — OOM killer, sem mensagem que aponte a causa.

### Lightsail (recomendado)

| Plano | vCPU | RAM | SSD | Transferencia | Serve? |
| --- | --- | --- | --- | --- | --- |
| US$ 5 | 2 | 0,5 GB | 20 GB | 1 TB | Não |
| US$ 7 | 2 | 1 GB | 40 GB | 2 TB | Só com build fora da VPS (ver §6) |
| **US$ 12** | 2 | **2 GB** | 60 GB | 3 TB | **Sim — escolha padrão** |
| US$ 24 | 2 | 4 GB | 80 GB | 4 TB | Folga; só se o trafego crescer |

O `provision-vps.sh` cria 2 GB de swap justamente para o plano de 2 GB
atravessar o pico do build sem OOM. Swap não substitui RAM — é rede de
protecao para um pico curto e previsivel.

**Por que Lightsail e não EC2 para este caso:** preço fixo (sem surpresa de
fatura), transferencia inclusa no pacote, IP estatico gratis enquanto anexado,
firewall no proprio painel. EC2 só compensa quando você precisa de Auto
Scaling, ALB, spot ou integracao fina com VPC — nada disso está no horizonte
de um MVP de container unico.

### Se preferir EC2

- `t4g.small` (2 vCPU ARM Graviton, 2 GB) é o equivalente mais barato.
- **Cuidado com ARM64:** `sharp` e os engines do Prisma tem binarios arm64, e
  `node:22-slim` é multi-arch — então funciona. Mas a imagem passa a ser
  arquitetura diferente da sua maquina de dev; qualquer `docker build` local
  para comparar precisa de `--platform linux/arm64`.
- Custos que o Lightsail embute e o EC2 cobra à parte: volume EBS, Elastic IP
  ocioso e **transferencia de saida**. Uma SPA com imagens pode gerar conta de
  egress relevante — no Lightsail isso já está no pacote.

---

## 2. Criar a instancia

1. **Lightsail → Create instance**
   - Regiao: `us-east-1` ou `sa-east-1` (São Paulo). São Paulo custa mais caro
     por instancia, mas corta ~100 ms de latencia para usuarios no Brasil.
     Para um marketplace local, **sa-east-1 é a escolha certa**.
   - Blueprint: **OS Only → Ubuntu 24.04 LTS**.
   - Plano: **2 GB**.
   - Chave SSH: crie um par novo e **baixe o `.pem`** (só aparece uma vez).

2. **Networking → Create static IP** e anexe à instancia.
   Sem IP estatico, um stop/start troca o IP e o DNS aponta para o vazio.

3. **Networking → Firewall** da instancia. Deixe apenas:

   | Aplicacao | Protocolo | Porta |
   | --- | --- | --- |
   | SSH | TCP | 22 |
   | HTTP | TCP | 80 |
   | HTTPS | TCP | 443 |
   | Custom | UDP | 443 (HTTP/3 — opcional) |

   Remova qualquer regra de 3333. O `compose.yml` não publica essa porta: quem
   fala com a internet é o Caddy.

> **Nota sobre ufw + Docker:** o `ufw` não filtra portas publicadas por
> container — o Docker escreve direto na cadeia `DOCKER` do iptables, antes das
> regras do ufw. Um `ports: 3333:3333` esquecido fica exposto mesmo com o ufw
> "fechado". O firewall do Lightsail, por ser externo à maquina, não tem esse
> problema — use os dois.

---

## 3. Provisionar

O repo é **privado**: `curl` no raw e `git clone` HTTPS anonimo nao funcionam.
O script de provisionamento vai por `scp`, e o clone usa uma deploy key (§4).

```bash
chmod 400 ~/Downloads/LightsailDefaultKey.pem

# da maquina de dev: enviar o script (esta no proprio repo local)
scp -i ~/Downloads/LightsailDefaultKey.pem scripts/provision-vps.sh ubuntu@<IP-ESTATICO>:provision.sh

ssh -i ~/Downloads/LightsailDefaultKey.pem ubuntu@<IP-ESTATICO>
# na VPS
sudo bash provision.sh deploy
```

O script instala Docker + compose plugin, cria 2 GB de swap, configura ufw,
fail2ban, unattended-upgrades, rotacao global de log do Docker, cria o usuario
`deploy` (grupo docker, sudo sem senha) e herda as chaves SSH já autorizadas.

**Ele não desabilita senha/root no SSH sozinho de proposito.** Fazer isso antes
de validar a chave tranca você para fora da propria maquina. O script imprime o
comando para rodar depois — execute-o só quando `ssh deploy@<ip>` funcionar em
outro terminal.

---

## 4. Codigo e variaveis

Repo privado → o clone (e o `git fetch` que o `deploy.sh` roda a cada deploy)
precisa de credencial. Use uma **deploy key** read-only, escopada a este repo —
melhor que PAT: se a VPS for comprometida, a chave nao abre mais nada.

```bash
# na VPS, como o usuario deploy
sudo -u deploy ssh-keygen -t ed25519 -N "" -f /home/deploy/.ssh/id_ed25519 -C "deploy-key primeiroaqui lightsail"
sudo -u deploy cat /home/deploy/.ssh/id_ed25519.pub
```

Cadastre a chave publica em GitHub → repo → **Settings → Deploy keys →
Add deploy key** (SEM marcar "Allow write access"). Depois:

```bash
sudo -u deploy git clone git@github.com:jeremiasmarinho/primeiroaqui.git /opt/primeiroaqui
cd /opt/primeiroaqui
sudo -u deploy install -m 600 /dev/null .env
sudo -u deploy nano .env
```

Preencha com base em `.env.production.example` **mais duas variaveis novas**,
consumidas pelo Caddy:

```dotenv
DOMAIN=primeiroaqui.koraforce.com.br
ACME_EMAIL=voce@dominio.com.br
```

Checklist do que o `deploy.sh` exige (ele falha antes de subir se faltar):
`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE`, `PAGARME_SECRET_KEY`, `PAGARME_WEBHOOK_SECRET`,
`PAGARME_PLATFORM_RECIPIENT_ID`, `DOMAIN`, `ACME_EMAIL`.

Lembretes que já custaram tempo neste projeto:

- `DATABASE_URL` = pooler do Supabase em **modo transaction (6543)**. Apontar
  para 5432 esgota o limite de conexoes sob carga — e o sintoma só aparece em
  pico, nunca em teste. `DIRECT_URL` (5432) é só para migrations.
- **Nunca** coloque `NODE_ENV` em `.env.local` na maquina de dev: o Vite lê e
  quebra o bundle de producao (313 KB → 553 KB, sem erro visivel).
- O `.env` fica com permissao `600` e fora do git. O `.dockerignore` bloqueia
  todo `.env*` de entrar na imagem.

**Não cole segredos em chat, ticket ou transcricao de sessao de IA.** Transfira
por `scp` ou digite direto no `nano` da VPS.

---

## 5. DNS e primeiro deploy

O Caddy resolve o certificado pelo desafio HTTP-01, que **consulta o DNS
publico**. Se o dominio ainda apontar para a Hostinger, a emissao falha e o
Caddy entra em backoff.

Ordem correta:

1. Baixe o TTL do registro A para **300 s** e espere o TTL antigo expirar.
2. Troque o registro A para o IP estatico da Lightsail.
3. Confirme a propagacao: `dig +short primeiroaqui.koraforce.com.br`
4. Só então: `cd /opt/primeiroaqui && ./scripts/deploy.sh`

Quer validar o caminho ACME **antes** de virar o DNS? Descomente a linha
`acme_ca ...staging...` no `deploy/Caddyfile`. Gera certificado invalido no
browser, mas não consome o limite de 5 certificados por dominio por semana do
Let's Encrypt — limite que, se estourado, deixa você sem HTTPS por dias.

O `deploy.sh` faz: preflight de `.env` e disco → `git reset --hard origin/<branch>`
→ tag de rollback da imagem atual → build → `up -d` → espera `healthy` (120 s) →
health interno e publico → prune. **Se o health não ficar verde, ele volta
sozinho para `primeiro-aqui:previous` e sai com erro.**

---

## 6. Alternativa: build fora da VPS (habilita o plano de US$ 7)

Se quiser cortar para 1 GB de RAM, tire o build da VPS: o GitHub Actions
constroi a imagem, publica no GHCR, e a VPS só faz `pull`. A VPS deixa de
precisar de RAM de build, de `git`, e o deploy cai de ~3 min para ~20 s.

Troque no `compose.yml`:

```yaml
  app:
    image: ghcr.io/jeremiasmarinho/primeiroaqui:latest
    # remova o bloco `build:`
```

E o deploy vira `docker compose pull app && docker compose up -d app`.
Posso escrever o workflow se você quiser seguir por aqui.

---

## 7. Cutover a partir da Hostinger — checklist

Nada disso é automatico; cada item já quebrou producao em algum projeto.

- [ ] Nova VPS respondendo em `https://<dominio>/api/health` → `{"status":"ok"}`
- [ ] Rota funda da SPA (`/produto/1`) devolve o app, não 404
- [ ] **Webhook do Pagar.me** repontado para a nova URL — se o dominio não
      mudou, nada a fazer; se você testar por IP/subdominio temporario, o
      webhook precisa apontar para lá ou pagamentos ficam sem confirmacao
- [ ] `PAGARME_WEBHOOK_SECRET` presente — sem ele o webhook **aceita qualquer
      payload**
- [ ] Google Pay: dominio validado no Business Console aponta para o host certo
- [ ] Workflow `uptime.yml` continua verde (roda de 15 em 15 min)
- [ ] Supabase: se houver allowlist de IP no banco, adicionar o IP da Lightsail
      **antes** do cutover
- [ ] Manter a VPS Hostinger ligada por **7 dias** apos o cutover — rollback de
      DNS é o unico plano B real
- [ ] Só desligar a Hostinger depois de 7 dias sem incidente

---

## 8. Pendencia de seguranca herdada

O `docs/runbook.md` registra que a service-role key do Supabase e a senha do
banco foram expostas em transcricao de sessao de IA em ago/2026, com rotacao
**pendente**. A troca de servidor é o momento natural para fechar isso: você
vai preencher um `.env` novo de qualquer jeito.

Ordem: resetar senha do banco no Supabase → rotacionar a service-role key →
gravar os valores novos direto no `.env` da VPS nova → subir → validar
`/api/health` e um fluxo autenticado → só então virar o DNS. A `SUPABASE_ANON_KEY`
não precisa rotacionar (é publica por design; RLS é a protecao).

---

## 9. Operacao do dia a dia

```bash
# deploy
ssh deploy@<ip> "cd /opt/primeiroaqui && ./scripts/deploy.sh"

# logs
ssh deploy@<ip> "cd /opt/primeiroaqui && docker compose logs -f --tail 100 app"

# estado
ssh deploy@<ip> "cd /opt/primeiroaqui && docker compose ps"

# rollback manual
ssh deploy@<ip> "cd /opt/primeiroaqui && docker tag primeiro-aqui:previous primeiro-aqui:latest && docker compose up -d --no-build app"

# migration (da MAQUINA DE DEV, com DIRECT_URL de producao, antes de promover)
npx prisma migrate status
npx prisma migrate deploy
```

Snapshot automatico do Lightsail: **Instance → Snapshots → Enable automatic
snapshots**. Custa ~US$ 0,05/GB-mes e é o unico backup da configuracao da
maquina — o banco continua sendo responsabilidade do Supabase.
