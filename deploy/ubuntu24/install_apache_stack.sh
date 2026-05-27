#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${1:-}"
BRANCH="${2:-main}"
APP_DIR="${APP_DIR:-/var/www/axis_production}"
DOMAIN="${DOMAIN:-_}"
PM2_NAME="${PM2_NAME:-axis-production-backend}"

if [[ -z "${REPO_URL}" ]]; then
  echo "Usage: $0 <repo-url> [branch]"
  echo "Example: $0 https://github.com/your-user/axis_production.git main"
  exit 1
fi

echo "==> Installing base packages"
sudo apt update
sudo apt install -y ca-certificates curl gnupg git apache2 build-essential

echo "==> Installing Node.js 20"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

echo "==> Preparing app directory"
sudo mkdir -p "$(dirname "${APP_DIR}")"
if [[ ! -d "${APP_DIR}/.git" ]]; then
  sudo git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
else
  sudo git -C "${APP_DIR}" fetch origin
  sudo git -C "${APP_DIR}" checkout "${BRANCH}"
  sudo git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
fi
sudo chown -R "$USER":"$USER" "${APP_DIR}"

echo "==> Installing Node dependencies"
cd "${APP_DIR}"
npm install

if [[ ! -f "${APP_DIR}/backend/.env" && -f "${APP_DIR}/backend/.env.example" ]]; then
  cp "${APP_DIR}/backend/.env.example" "${APP_DIR}/backend/.env"
  echo "Created backend/.env from .env.example. Update secrets before starting."
fi

echo "==> Configuring PM2 process"
if pm2 describe "${PM2_NAME}" >/dev/null 2>&1; then
  pm2 reload "${PM2_NAME}" || pm2 restart "${PM2_NAME}"
else
  pm2 start npm --name "${PM2_NAME}" -- run start
fi
pm2 save

echo "==> Enabling Apache modules"
sudo a2enmod proxy proxy_http headers rewrite ssl

echo "==> Installing Apache site config"
APACHE_TEMPLATE="${APP_DIR}/deploy/ubuntu24/axis_production.apache.conf"
APACHE_SITE="/etc/apache2/sites-available/axis_production.conf"
sed -e "s|__APP_DIR__|${APP_DIR}|g" -e "s|__DOMAIN__|${DOMAIN}|g" "${APACHE_TEMPLATE}" | sudo tee "${APACHE_SITE}" >/dev/null

sudo a2dissite 000-default.conf || true
sudo a2ensite axis_production.conf
sudo apache2ctl configtest
sudo systemctl restart apache2
sudo systemctl enable apache2

echo "==> Verifying local endpoints"
curl -fsS -I http://127.0.0.1 >/dev/null
curl -fsS http://127.0.0.1/api/health >/dev/null

echo "==> Setup complete"
echo "App dir:  ${APP_DIR}"
echo "Domain:   ${DOMAIN}"
echo "Process:  ${PM2_NAME}"
echo
echo "Run this once to auto-start PM2 after reboot:"
echo "sudo env PATH=\$PATH pm2 startup systemd -u $USER --hp $HOME"
