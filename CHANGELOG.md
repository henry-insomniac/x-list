# Changelog

本项目变更记录（面向部署/对接/运维）。

> 约定：
> - 以 `feat/x-list-mvp` 分支上的提交为准汇总
> - 版本号暂未正式发布，先按日期+主题记录

## 2026-01（当前：feat/x-list-mvp）

### 新增

- **基础架构**：新增 `backend/`（Fastify + PostgreSQL）与 `frontend/`（React + Vite）项目骨架。
- **数据库迁移**：新增迁移系统与初始表结构 `tweets`，并启用 `pg_trgm` 以支持关键词搜索。
- **API（写入/删除鉴权）**：
  - `POST /api/tweets`（`X-API-Key`）
  - `GET /api/tweets`（分页）
  - `GET /api/tweets/search`（关键词搜索 + 分页）
  - `DELETE /api/tweets/:id`（`X-API-Key`）
- **暗色 UI**：卡片化列表、分页加载、搜索。
- **推文预览（可选）**：对 X/Twitter 链接支持 `widgets.js` 嵌入预览，失败自动回退到普通链接。

### 变更 / 增强

- **渠道（channel）支持**：
  - DB：`tweets` 增加 `channel` 字段（默认 `x`），并增加 `(channel, created_at desc, id desc)` 索引。
  - API：写入 `POST /api/tweets` body 增加可选 `channel`；列表/搜索接口支持 `?channel=` 过滤；DTO 增加 `channel` 字段返回。
  - 前端：新增渠道筛选下拉（全部 / X / 小红书），卡片显示来源 badge，默认头像随渠道变化。
- **时间分组**：列表模式默认按“最近 24 小时 / 更早”分组展示，并支持展开更早内容。
- **交互升级**：
  - 快捷筛选 chips：最近24h/全部时间、仅预览、未读、密度（紧凑/舒适）、清空已读
  - 搜索体验：清空按钮、搜索历史（本地）
  - 阅读体验：已读状态本地记忆、列表模式滚动位置记忆
  - 卡片操作：复制链接、标记已读/未读（本地）
  - 加载更多：在“最近24h”模式下点击会自动展开“更早”以减少打断

### 部署相关

- **一键部署脚本**：新增 `deploy/install.sh`，支持：
  - 自动安装依赖（Docker/Node/pnpm/Nginx）、启动 Postgres、跑迁移、构建前端、配置 Nginx 反代、PM2 常驻后端
  - 适配代理/网络不稳定（git 超时、压缩包 fallback、可选 `USE_ARCHIVE=1`）
  - 可配置端口（避免与 Gitea 等服务冲突）：`API_PORT`、`NGINX_PORT`、`PG_PORT`
  - **渠道白名单可配置**：`CHANNELS_ALLOWED` 会写入 `backend/.env`

### 文档

- 新增接口文档：`docs/x-api.md`（含 `channel`、筛选/搜索参数、返回字段）。

### 升级/部署注意事项

- **需要执行迁移**：上线 `channel` 功能前，确保执行 `pnpm migrate`（会应用 `backend/migrations/002_add_channel.sql`）。
- **环境变量**：
  - 后端新增 `CHANNELS_ALLOWED`（默认 `x,xhs`），写入/筛选都会校验该白名单。
- **端口冲突**：
  - 如果服务器上已有 Gitea（常用 `3000/8088`），建议为 x-list 选择独立端口（部署脚本默认已做“更安全端口”设置）。

