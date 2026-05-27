#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/axis_production"
PM2_NAME="axis-production-backend"
API_HEALTH_URL="http://127.0.0.1:5000/api/health"
WEB_HEALTH_URL="http://127.0.0.1"
TARGET="${1:-HEAD~1}"

echo "==> Rollback started"
echo "    app:    ${APP_DIR}"
echo "    target: ${TARGET}"

if [[ ! -d "${APP_DIR}" ]]; then
  echo "ERROR: app directory not found: ${APP_DIR}"
  exit 1
fi

cd "${APP_DIR}"

echo "==> Fetching latest refs"
git fetch --all --tags

echo "==> Checking out target commit/ref"
git checkout "${TARGET}"

echo "==> Installing dependencies"
npm install

echo "==> Restarting app via PM2"
if pm2 describe "${PM2_NAME}" >/dev/null 2>&1; then
  pm2 reload "${PM2_NAME}" || pm2 restart "${PM2_NAME}"
else
  pm2 start npm --name "${PM2_NAME}" -- run start
fi
pm2 save

echo "==> Health checks"
echo "    web: ${WEB_HEALTH_URL}"
curl -fsS -I "${WEB_HEALTH_URL}" >/dev/null
echo "    ok"

echo "    api: ${API_HEALTH_URL}"
curl -fsS "${API_HEALTH_URL}" >/dev/null
echo "    ok"

echo "==> Rollback complete"
echo "    current commit: $(git rev-parse --short HEAD)"
