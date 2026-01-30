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

