# x-list

展示推荐推文集合的 Web 应用（内容可定期更新/录入）。

## 目录结构

- `backend/`：Node + Fastify + PostgreSQL（REST API）
- `frontend/`：React + Vite（暗色主题卡片列表）

## 本地开发（前端）

```bash
cd frontend
pnpm install --store-dir ../.pnpm-store
pnpm dev
```

前端默认读取 `VITE_API_BASE_URL`，可在 `frontend/.env` 中配置，例如：

```bash
cp frontend/env.example frontend/.env
```

## 本地开发（后端）

启动 Postgres：

```bash
docker compose up -d db
```

说明：如果你本机 `5432` 已被占用，本项目默认把容器内 Postgres 映射到宿主机 `5433`。

然后执行迁移并运行服务：

```bash
cd backend
pnpm install --store-dir ../.pnpm-store
cp env.example .env
pnpm migrate
pnpm dev
```

## API 鉴权

- 写接口（录入/删除）需要 Header：`X-API-Key`
- 读接口（列表/搜索）公开

## 服务器一键部署（Ubuntu/Debian，root）

在服务器上执行（会安装 Docker/Node/Nginx，拉取分支并完成部署）：

```bash
curl -fsSL https://raw.githubusercontent.com/henry-insomniac/x-list/feat/x-list-mvp/deploy/install.sh | bash
```

可选环境变量（执行前加在命令前面）：

- `DOMAIN_OR_IP`：Nginx 的 `server_name`（默认 `_`）
- `NGINX_PORT`：Nginx 监听端口（默认 `80`，如需用 `6666` 可设置）
- `PG_PORT`：Postgres 映射端口（默认 `5433`）
- `API_PORT`：后端端口（默认 `3000`）
- `BRANCH`：部署分支（默认 `feat/x-list-mvp`）

