#!/usr/bin/env bash
# Zorya — pull the latest main, rebuild and restart. Run on the server: sudo bash /opt/zorya/deploy/update.sh
set -euo pipefail
APP_DIR=/opt/zorya

sudo -H -u zorya bash -c "cd '$APP_DIR' && git pull --ff-only && npm ci && npm run build"
install -m 644 "$APP_DIR/deploy/zorya.service" /etc/systemd/system/zorya.service
systemctl daemon-reload
systemctl restart zorya
systemctl --no-pager --lines=5 status zorya
