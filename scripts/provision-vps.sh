#!/usr/bin/env bash
# Provisiona uma VPS Ubuntu 22.04/24.04 nova (AWS Lightsail, EC2, Hostinger...)
# para receber o Primeiro Aqui: Docker, swap, firewall, fail2ban e o diretorio
# de deploy. Idempotente — pode rodar de novo sem quebrar nada.
#
# Rodar UMA vez, como root ou com sudo, na VPS recem-criada:
#   curl -fsSL <raw-url>/scripts/provision-vps.sh -o provision.sh
#   sudo bash provision.sh deploy   # 'deploy' = usuario que vai operar o app
#
# NAO desabilita senha no SSH automaticamente: fazer isso antes de confirmar
# que a chave publica funciona tranca voce para fora da propria maquina. O
# passo final imprime o comando para voce rodar depois de validar o acesso.

set -euo pipefail

APP_USER="${1:-deploy}"
APP_DIR="/opt/primeiroaqui"
SWAP_SIZE="2G"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Rode como root (sudo bash $0)"; exit 1; }

log "1/7 Pacotes base e atualizacoes de seguranca automaticas"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git ufw fail2ban unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

log "2/7 Swap de ${SWAP_SIZE}"
# O `vite build` + `npm ci` deste projeto passa de 1 GB de pico. Numa VPS de
# 1 GB de RAM o build morre com "Killed" (OOM) e o erro nao diz que foi memoria.
# Swap nao substitui RAM, mas evita o OOM killer durante o build.
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
else
  echo "swap ja configurado, pulando"
fi

log "3/7 Docker Engine + plugin compose (repo oficial)"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  echo "docker ja instalado ($(docker --version))"
fi

log "4/7 Rotacao global de log do Docker"
# Rede de seguranca: o compose.yml ja limita, mas qualquer container avulso
# (um `docker run` de teste esquecido) enche o disco sem isso.
cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" },
  "live-restore": true
}
JSON
systemctl restart docker

log "5/7 Usuario de deploy: ${APP_USER}"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$APP_USER"
fi
usermod -aG docker "$APP_USER"
echo "${APP_USER} ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-${APP_USER}"
chmod 0440 "/etc/sudoers.d/90-${APP_USER}"

# Herda as chaves ja autorizadas para root (o Lightsail/EC2 injeta a chave do
# par escolhido na criacao em root ou ubuntu) para nao exigir upload manual.
for src in /root/.ssh/authorized_keys /home/ubuntu/.ssh/authorized_keys; do
  if [ -s "$src" ]; then
    install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/${APP_USER}/.ssh"
    cat "$src" >> "/home/${APP_USER}/.ssh/authorized_keys"
    sort -u -o "/home/${APP_USER}/.ssh/authorized_keys" "/home/${APP_USER}/.ssh/authorized_keys"
    chown "$APP_USER:$APP_USER" "/home/${APP_USER}/.ssh/authorized_keys"
    chmod 600 "/home/${APP_USER}/.ssh/authorized_keys"
    echo "chaves copiadas de ${src}"
    break
  fi
done

log "6/7 Firewall (ufw) e fail2ban"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp   comment 'ssh'    >/dev/null
ufw allow 80/tcp   comment 'http'   >/dev/null
ufw allow 443/tcp  comment 'https'  >/dev/null
ufw allow 443/udp  comment 'http3'  >/dev/null
ufw --force enable >/dev/null
# ATENCAO: o ufw NAO filtra portas publicadas por container (o Docker escreve
# direto na cadeia DOCKER do iptables, antes das regras do ufw). Por isso o
# compose.yml nao publica a 3333 — a unica porta publicada e a do Caddy.
systemctl enable --now fail2ban

log "7/7 Diretorio de deploy"
install -d -m 0755 -o "$APP_USER" -g "$APP_USER" "$APP_DIR"

cat <<EOF

──────────────────────────────────────────────────────────────
Provisionamento concluido.

Proximos passos (nesta ordem):

 1. Em OUTRO terminal, confirme que a chave funciona:
      ssh ${APP_USER}@<IP-DA-VPS> "docker --version"
    So siga adiante se isso funcionar.

 2. So entao feche o SSH por senha/root:
      sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/;s/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
      sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config.d/*.conf 2>/dev/null || true
      sudo systemctl reload ssh

 3. Clone o projeto e crie o .env:
      sudo -u ${APP_USER} git clone <url-do-repo> ${APP_DIR}
      sudo -u ${APP_USER} install -m 600 /dev/null ${APP_DIR}/.env
      # preencha ${APP_DIR}/.env usando .env.production.example + DOMAIN/ACME_EMAIL

 4. Aponte o registro A do dominio para o IP DESTA VPS e espere propagar.

 5. Suba a stack:
      cd ${APP_DIR} && ./scripts/deploy.sh
──────────────────────────────────────────────────────────────
EOF
