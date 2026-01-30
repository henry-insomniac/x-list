#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "请用 root 执行（或 sudo）。"
  exit 1
fi

APP_DIR="${APP_DIR:-/opt/x-list}"
REPO_URL="${REPO_URL:-https://github.com/henry-insomniac/x-list.git}"
BRANCH="${BRANCH:-feat/x-list-mvp}"

DOMAIN_OR_IP="${DOMAIN_OR_IP:-_}"
# 默认避开常见占用（例如 Gitea 常用 3000）
API_PORT="${API_PORT:-3100}"
PG_PORT="${PG_PORT:-5433}"
# 默认避开 80/443 等常用端口，且避免浏览器不安全端口
NGINX_PORT="${NGINX_PORT:-8090}"
USE_ARCHIVE="${USE_ARCHIVE:-0}"

# apt 强制不走代理（覆盖 /etc/apt/apt.conf.d 里的 Proxy 配置）
APT_GET=(apt-get -o Acquire::http::Proxy=false -o Acquire::https::Proxy=false)

echo "[1/9] 安装系统依赖（git/curl/nginx）"
export DEBIAN_FRONTEND=noninteractive
"${APT_GET[@]}" update -y
"${APT_GET[@]}" install -y git curl ca-certificates gnupg nginx python3

echo "[2/9] 安装 Docker（如未安装）"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

if ! docker compose version >/dev/null 2>&1; then
  echo "未检测到 docker compose 插件，尝试安装 docker-compose-plugin..."
  "${APT_GET[@]}" install -y docker-compose-plugin || true
fi

echo "[3/9] 安装 Node.js 22 + pnpm（如未安装）"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  "${APT_GET[@]}" install -y nodejs
fi

# 重要：某些环境（比如 nvm + Node 23）自带的 corepack 会因为签名 key 不匹配而报错。
# 且 pnpm 可能是 corepack 的 shim，即便没安装 pnpm 也会 “command -v pnpm” 成功。
# 这里强制检测 shim 并用 npm 全局安装 pnpm，避免触发 corepack。
PNPM_BIN="$(command -v pnpm || true)"
NEED_PNPM=0
if [[ -z "${PNPM_BIN}" ]]; then
  NEED_PNPM=1
elif [[ -f "${PNPM_BIN}" ]] && grep -q "corepack" "${PNPM_BIN}" 2>/dev/null; then
  # 删除 corepack shim，避免 npm install -g 报 EEXIST
  rm -f "${PNPM_BIN}" || true
  rm -f "$(dirname "${PNPM_BIN}")/pnpx" || true
  NEED_PNPM=1
fi
if [[ "${NEED_PNPM}" -eq 1 ]]; then
  npm i -g pnpm@10.28.2 --force
fi

echo "[4/9] 获取代码到 ${APP_DIR}"
mkdir -p "${APP_DIR}"
export GIT_TERMINAL_PROMPT=0
GIT_TIMEOUT="${GIT_TIMEOUT:-240}"
GIT_CMD=(git -c http.lowSpeedLimit=1 -c http.lowSpeedTime=60)
REPO_OWNER_REPO="${REPO_OWNER_REPO:-henry-insomniac/x-list}"
ARCHIVE_BASE="${ARCHIVE_BASE:-https://codeload.github.com/${REPO_OWNER_REPO}/tar.gz/refs/heads}"
ARCHIVE_URL="${ARCHIVE_URL:-${ARCHIVE_BASE}/${BRANCH}}"
ARCHIVE_PROXY_PREFIX="${ARCHIVE_PROXY_PREFIX:-}"

download_archive() {
  echo "git 连接慢，改用压缩包下载..."
  rm -rf "${APP_DIR}"
  mkdir -p "${APP_DIR}"
  tmp="/tmp/x-list-${BRANCH//\//-}.tgz"
  url="${ARCHIVE_PROXY_PREFIX}${ARCHIVE_URL}"
  echo "下载：${url}"
  curl -fL --connect-timeout 15 --max-time "${GIT_TIMEOUT}" "${url}" -o "${tmp}"
  tar -xzf "${tmp}" -C /tmp
  # 解压目录一般为 <repo>-<branch> 或 <repo>-<sha>
  extracted="$(tar -tzf "${tmp}" | head -n1 | cut -d/ -f1)"
  rm -rf "${APP_DIR}"
  mv "/tmp/${extracted}" "${APP_DIR}"
  rm -f "${tmp}"
  echo "已解压到 ${APP_DIR}"
}

if [[ "${USE_ARCHIVE}" == "1" ]]; then
  download_archive
else
if [[ -d "${APP_DIR}/.git" ]]; then
  echo "更新代码（超时 ${GIT_TIMEOUT}s）..."
  if ! timeout "${GIT_TIMEOUT}" "${GIT_CMD[@]}" -C "${APP_DIR}" fetch --all --prune --tags --progress; then
    download_archive
  fi
  "${GIT_CMD[@]}" -C "${APP_DIR}" checkout "${BRANCH}"
  if ! timeout "${GIT_TIMEOUT}" "${GIT_CMD[@]}" -C "${APP_DIR}" pull --ff-only --progress; then
    download_archive
  fi
else
  echo "克隆代码（超时 ${GIT_TIMEOUT}s）..."
  if ! timeout "${GIT_TIMEOUT}" "${GIT_CMD[@]}" clone -b "${BRANCH}" --depth 1 --progress "${REPO_URL}" "${APP_DIR}"; then
    download_archive
  fi
fi
fi

echo "[5/9] 启动 PostgreSQL（Docker Compose），宿主机端口 ${PG_PORT}"
cd "${APP_DIR}"
PG_PORT="${PG_PORT}" docker compose up -d db

echo "[6/9] 配置后端环境并迁移数据库"
cd "${APP_DIR}/backend"
pnpm install --no-frozen-lockfile --store-dir "${APP_DIR}/.pnpm-store"

if [[ ! -f ".env" ]]; then
  cp env.example .env
fi

API_KEY="${API_KEY:-}"
if [[ -z "${API_KEY}" ]]; then
  API_KEY="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(32))
PY
)"
fi

DATABASE_URL="postgres://postgres:postgres@localhost:${PG_PORT}/x_list"

set +e
grep -q '^API_KEY=' .env
HAS_API_KEY=$?
grep -q '^DATABASE_URL=' .env
HAS_DB_URL=$?
set -e

if [[ "${HAS_API_KEY}" -ne 0 ]]; then
  echo "API_KEY=${API_KEY}" >> .env
else
  sed -i "s|^API_KEY=.*$|API_KEY=${API_KEY}|g" .env
fi

if [[ "${HAS_DB_URL}" -ne 0 ]]; then
  echo "DATABASE_URL=${DATABASE_URL}" >> .env
else
  sed -i "s|^DATABASE_URL=.*$|DATABASE_URL=${DATABASE_URL}|g" .env
fi

if ! grep -q '^PORT=' .env; then
  echo "PORT=${API_PORT}" >> .env
else
  sed -i "s|^PORT=.*$|PORT=${API_PORT}|g" .env
fi

if ! grep -q '^CORS_ORIGIN=' .env; then
  echo "CORS_ORIGIN=*" >> .env
fi

pnpm migrate
pnpm build

echo "[7/9] 使用 PM2 常驻后端"
if ! command -v pm2 >/dev/null 2>&1; then
  npm i -g pm2
fi

pm2 delete x-list-backend >/dev/null 2>&1 || true
set -a
source .env
set +a
pm2 start dist/src/index.js --name x-list-backend --update-env
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

echo "[8/9] 构建前端并配置 Nginx（静态 + /api 反代）"
cd "${APP_DIR}/frontend"
pnpm install --no-frozen-lockfile --store-dir "${APP_DIR}/.pnpm-store"

cat > .env <<EOF
VITE_API_BASE_URL=
EOF

pnpm build

mkdir -p /var/www/x-list
rm -rf /var/www/x-list/*
cp -r dist/* /var/www/x-list/

cat > /etc/nginx/sites-available/x-list <<EOF
server {
  listen ${NGINX_PORT};
  server_name ${DOMAIN_OR_IP};

  root /var/www/x-list;
  index index.html;

  location / {
    try_files \$uri /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:${API_PORT}/api/;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF

ln -sf /etc/nginx/sites-available/x-list /etc/nginx/sites-enabled/x-list
rm -f /etc/nginx/sites-enabled/default || true
nginx -t
systemctl reload nginx

echo "[9/9] 完成"
echo "前端： http://${DOMAIN_OR_IP}:${NGINX_PORT}/"
echo "后端接口： http://${DOMAIN_OR_IP}:${NGINX_PORT}/api/tweets （若为空会返回 items 空数组）"
echo "写接口 API_KEY（已写入 ${APP_DIR}/backend/.env）："
echo "${API_KEY}"

