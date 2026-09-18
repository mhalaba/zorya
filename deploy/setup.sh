#!/usr/bin/env bash
# Zorya — one-time setup of a fresh Ubuntu 22.04/24.04 VM (Oracle Cloud Always Free, arm64 or amd64).
#
#   sudo ZORYA_HOST=203-0-113-7.sslip.io bash deploy/setup.sh
#
# ZORYA_HOST must resolve to this VM. <ip-with-dashes>.sslip.io works without owning a domain;
# Caddy gets a Let's Encrypt certificate for it (Web Push and the service worker need HTTPS).
set -euo pipefail

: "${ZORYA_HOST:?set ZORYA_HOST, e.g. 203-0-113-7.sslip.io}"
REPO="${REPO:-https://github.com/mhalaba/zorya.git}"
APP_DIR=/opt/zorya
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y ca-certificates curl gnupg git debian-keyring debian-archive-keyring apt-transport-https iptables-persistent

# The 1 GB micro shape cannot run the TypeScript + Vite build without swap.
if [ "$(awk '/MemTotal/ {print $2}' /proc/meminfo)" -lt 2000000 ] && ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Node.js 22 LTS (NodeSource) and Caddy (official apt repository).
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

id zorya >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/zorya --shell /usr/sbin/nologin zorya
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO" "$APP_DIR"
fi
chown -R zorya:zorya "$APP_DIR"
sudo -H -u zorya bash -c "cd '$APP_DIR' && npm ci && npm run build"

# The VAPID subject is the site itself: Apple's push service rejects "@localhost" contacts.
cat > /etc/zorya.env <<EOF
VAPID_SUBJECT=https://$ZORYA_HOST
EOF

install -m 644 "$APP_DIR/deploy/zorya.service" /etc/systemd/system/zorya.service
sed "s/{\$ZORYA_HOST}/$ZORYA_HOST/" "$APP_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile

# Oracle's Ubuntu images reject everything but SSH in iptables; the VCN security list must allow 80/443 too.
for port in 80 443; do
  iptables -C INPUT -p tcp --dport "$port" -m conntrack --ctstate NEW -j ACCEPT 2>/dev/null ||
    iptables -I INPUT 1 -p tcp --dport "$port" -m conntrack --ctstate NEW -j ACCEPT
done
netfilter-persistent save

systemctl daemon-reload
systemctl enable --now zorya
systemctl reload caddy || systemctl restart caddy

echo "Zorya: https://$ZORYA_HOST"
