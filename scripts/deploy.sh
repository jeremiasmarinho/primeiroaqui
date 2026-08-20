#!/usr/bin/env bash
# Deploy do Primeiro Aqui na VPS. Roda DENTRO da VPS, no diretorio do projeto:
#   cd /opt/primeiroaqui && ./scripts/deploy.sh
# Ou a partir da maquina de dev:
#   ssh deploy@<ip> "cd /opt/primeiroaqui && ./scripts/deploy.sh"
#
# NAO roda migration. Migration e passo humano deliberado, executado da
# maquina de dev com DIRECT_URL de producao ANTES de promover a imagem nova.
# Ver docs/runbook.md (secao de drift do Prisma).
#
# Rollback e automatico: se o health nao ficar verde, volta para a imagem
# anterior e sai com erro.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

ENV_FILE="${APP_DIR}/.env"
HEALTH_URL="http://127.0.0.1:3333/api/health"
HEALTH_TIMEOUT=120

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[erro]\033[0m %s\n' "$*" >&2; exit 1; }

# ── Preflight ────────────────────────────────────────────────────────────────
# Variavel faltando faz o container subir e morrer com uma mensagem enterrada
# em `docker logs`. Barato conferir antes.
log "Preflight: arquivo de ambiente"
[ -f "$ENV_FILE" ] || fail ".env ausente em ${ENV_FILE} — ver .env.production.example"
perms="$(stat -c '%a' "$ENV_FILE")"
[ "$perms" = "600" ] || printf '\033[1;33m[!]\033[0m .env com permissao %s (esperado 600): chmod 600 %s\n' "$perms" "$ENV_FILE"

REQUIRED=(
  DATABASE_URL DIRECT_URL
  SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE
  PAGARME_SECRET_KEY PAGARME_WEBHOOK_SECRET PAGARME_PLATFORM_RECIPIENT_ID
  DOMAIN ACME_EMAIL
)
missing=()
for var in "${REQUIRED[@]}"; do
  # Aceita apenas linhas com valor nao-vazio; `VAR=` conta como ausente.
  grep -qE "^[[:space:]]*${var}=[^[:space:]]" "$ENV_FILE" || missing+=("$var")
done
[ ${#missing[@]} -eq 0 ] || fail "variaveis ausentes/vazias no .env: ${missing[*]}"

# O runbook e explicito: DATABASE_URL tem que ser o pooler em modo transaction
# (6543). Apontar para 5432 esgota o limite de conexoes do Supabase sob carga,
# e o sintoma aparece so em pico — nunca em teste.
if grep -qE '^[[:space:]]*DATABASE_URL=.*:5432' "$ENV_FILE"; then
  printf '\033[1;33m[!]\033[0m DATABASE_URL aponta para :5432 (conexao de sessao). O runtime deve usar o pooler :6543.\n'
fi

log "Preflight: espaco em disco"
avail_mb=$(df -Pm "$APP_DIR" | awk 'NR==2{print $4}')
[ "$avail_mb" -gt 2048 ] || fail "menos de 2 GB livres (${avail_mb} MB) — rode: docker system prune -af"

# ── Codigo ───────────────────────────────────────────────────────────────────
log "Atualizando codigo"
git fetch --prune origin
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
BEFORE="$(git rev-parse --short HEAD)"
git reset --hard "origin/${BRANCH}"
AFTER="$(git rev-parse --short HEAD)"
echo "${BRANCH}: ${BEFORE} -> ${AFTER}"

# ── Ponto de rollback ────────────────────────────────────────────────────────
# Guarda a imagem que esta no ar hoje. Sem isso, um build quebrado deixa a
# producao sem para onde voltar.
if docker image inspect primeiro-aqui:latest >/dev/null 2>&1; then
  docker tag primeiro-aqui:latest primeiro-aqui:previous
  echo "rollback disponivel: primeiro-aqui:previous"
  HAS_ROLLBACK=1
else
  HAS_ROLLBACK=0
fi

log "Build da imagem"
docker compose build app

log "Subindo a stack"
docker compose up -d --remove-orphans

# ── Verificacao ──────────────────────────────────────────────────────────────
log "Aguardando health (ate ${HEALTH_TIMEOUT}s)"
deadline=$(( SECONDS + HEALTH_TIMEOUT ))
healthy=0
while [ $SECONDS -lt $deadline ]; do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q app)" 2>/dev/null || echo starting)"
  if [ "$status" = "healthy" ]; then healthy=1; break; fi
  if [ "$status" = "unhealthy" ]; then break; fi
  sleep 3
done

if [ "$healthy" -ne 1 ]; then
  printf '\033[1;31m[erro]\033[0m app nao ficou healthy. Ultimas linhas do log:\n'
  docker compose logs --tail 60 app || true
  if [ "$HAS_ROLLBACK" -eq 1 ]; then
    log "ROLLBACK para primeiro-aqui:previous"
    docker tag primeiro-aqui:previous primeiro-aqui:latest
    docker compose up -d --no-build app
    printf '\033[1;33m[!]\033[0m rollback aplicado. O commit %s continua no disco — investigue antes de tentar de novo.\n' "$AFTER"
  fi
  exit 1
fi

log "Health interno"
docker compose exec -T app node -e \
  "fetch('${HEALTH_URL}').then(r=>r.text()).then(t=>console.log(t))"

DOMAIN_VALUE="$(grep -E '^[[:space:]]*DOMAIN=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"' ')"
log "Health publico (https://${DOMAIN_VALUE}/api/health)"
code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "https://${DOMAIN_VALUE}/api/health" || echo 000)"
if [ "$code" = "200" ]; then
  echo "HTTP 200 — publico OK"
else
  printf '\033[1;33m[!]\033[0m health publico devolveu HTTP %s. Container esta saudavel, entao suspeite de DNS, ACME ou firewall.\n' "$code"
  echo "    docker compose logs --tail 40 caddy"
fi

log "Limpando imagens orfas"
docker image prune -f >/dev/null

printf '\n\033[1;32mDeploy concluido\033[0m — %s @ %s\n' "$BRANCH" "$AFTER"
echo "Valide tambem uma rota funda da SPA: https://${DOMAIN_VALUE}/produto/1"
