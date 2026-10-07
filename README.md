# lab1-counter：多容器共享计数器

一个由 **前端（Nginx）+ 后端（Node.js/Express）+ 数据库（PostgreSQL）** 三个独立服务组成的共享计数器，使用 Docker Compose 一键构建和启动，计数保存在 Docker 命名数据卷中。


## 1. 小组成员与分工

| 姓名 | 学号 | Git 身份（user.name / user.email） | 实际分工 |
| --- | --- | --- | --- |
| （组长）XXX | XXXXXXXX | xxx / xxx@example.com | Compose 编排、README、验收记录汇总 |
| XXX | XXXXXXXX | xxx / xxx@example.com | 后端 API 与数据库初始化 |
| XXX | XXXXXXXX | xxx / xxx@example.com | 前端页面与 Nginx 反向代理 |

组号：XX　联系助教：XXX

## 2. 技术栈

| 服务 | 技术 | 镜像 |
| --- | --- | --- |
| `frontend` | 原生 HTML + JavaScript，Nginx 提供静态页面并反向代理 `/api` | 基于 `nginx:1.27.3-alpine` 构建 |
| `backend` | Node.js 20 + Express 4 + node-postgres (`pg`) | 基于 `node:20.18-alpine3.20` 构建 |
| `db` | PostgreSQL 16 | `postgres:16.4-alpine` |

所有镜像均标注具体版本，未使用 `latest`。

## 3. 目录结构

```
lab1-counter/
├── frontend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── nginx.conf.template     # Nginx 配置模板（启动时由环境变量渲染）
│   └── public/
│       ├── index.html          # 计数页面
│       └── app.js              # 调用后端 API
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   ├── package-lock.json       # 依赖锁定文件
│   └── src/
│       ├── server.js           # HTTP 接口
│       └── db.js               # 数据库连接、初始化与原子加减
├── database/
│   └── init.sql                # 建表与首次初始化脚本（幂等）
├── docs/
│   ├── validation.md           # 验收过程与结果
│   └── images/                 # 验收截图
├── compose.yaml
├── .env.example
├── .gitignore
└── README.md
```

## 4. 服务职责与请求流向

```
浏览器 ──HTTP :8088──▶ frontend (Nginx :80)
                         ├─ /        → 返回静态页面 index.html / app.js
                         └─ /api/... → 反向代理到 http://backend:3000
                                              │
                                   backend (Express :3000)
                                              │  SQL（服务名 db:5432）
                                              ▼
                                   db (PostgreSQL :5432)
                                              │
                                   命名卷 lab1-counter_counter-db-data
```

- **frontend**：提供计数页面；浏览器只请求同源的 `/api/...`，由 Nginx 按 Compose 服务名 `backend` 转发，因此无需处理跨域，也不写死容器 IP。
- **backend**：提供 REST API，执行计数逻辑并读写数据库。启动时等待数据库可连接（最多重试 30 次，每次间隔 2 秒），然后执行 `database/init.sql` 自动建表并初始化。
- **db**：保存计数数据，数据目录 `/var/lib/postgresql/data` 挂载到命名卷，只在 Compose 内部网络暴露端口。

启动顺序：`db` 健康检查（`pg_isready`）通过 → 启动 `backend`；`backend` 健康检查（`/api/health`）通过 → 启动 `frontend`。

## 5. 环境要求

- Docker Engine 24+（已在 Docker 29.4.0 上验证）
- Docker Compose v2.17+（需要支持 `additional_contexts`；已在 v5.1.2 上验证）
- 宿主机端口 `8088` 空闲（可在 `.env` 中修改）
- 首次构建需要能从 Docker Hub 和 npm 源拉取镜像与依赖

## 6. 环境变量

先复制示例文件：

```bash
cp .env.example .env
```

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `FRONTEND_PORT` | `8088` | 宿主机访问端口，映射到前端容器的 80 端口 |
| `BACKEND_PORT` | `3000` | 后端容器内监听端口（只在 Compose 网络内使用） |
| `POSTGRES_USER` | `counter` | 数据库用户名 |
| `POSTGRES_PASSWORD` | `change-me-please` | 数据库密码，**请修改** |
| `POSTGRES_DB` | `counter` | 数据库名 |

后端通过 `DB_HOST=db`、`DB_PORT=5432`、`DB_USER`、`DB_PASSWORD`、`DB_NAME` 连接数据库，这些值由 `compose.yaml` 从上述变量传入。

> 注意：`POSTGRES_*` 只在数据卷**第一次**初始化时生效。数据卷已存在后再修改用户名或密码，后端会连接失败，见第 11 节。

## 7. 启动与访问

在仓库根目录执行：

```bash
docker compose config -q        # 校验配置
docker compose up -d --build    # 构建并启动全部服务
docker compose ps -a            # 查看状态，三个服务都应为 Up (healthy)
```

浏览器访问：**<http://localhost:8088>**（修改 `FRONTEND_PORT` 后，把端口换成对应的值）

## 8. 接口说明

| 方法 | 路径 | 行为 | 成功响应示例 |
| --- | --- | --- | --- |
| `GET` | `/api/counter` | 查询当前值，不改变计数 | `{"value": 0}` |
| `POST` | `/api/counter/increment` | 将数据库中的值加 1，返回结果 | `{"value": 1}` |
| `POST` | `/api/counter/decrement` | 将数据库中的值减 1，返回结果（允许负数） | `{"value": 0}` |
| `GET` | `/api/health` | 健康检查，同时检测数据库连接 | `{"status": "ok"}` |

失败时后端返回 `500 {"error": "database operation failed"}`；后端不可用时 Nginx 返回 `502`。两种情况前端都会在页面上显示红色错误提示，并且不修改显示的数值。

命令行示例：

```bash
curl http://localhost:8088/api/counter
curl -X POST http://localhost:8088/api/counter/increment
curl -X POST http://localhost:8088/api/counter/decrement
```

## 9. 数据库表结构与查询命令

```sql
CREATE TABLE IF NOT EXISTS counter (
    id    INTEGER PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
);
INSERT INTO counter (id, value) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
```

- 只保存一条记录 `id = 1`。
- 初始化可重复执行：`CREATE TABLE IF NOT EXISTS` 和 `ON CONFLICT DO NOTHING` 保证后续启动不会把已有计数重置为 0。
- 加减使用单条原子语句 `UPDATE counter SET value = value + $1 WHERE id = 1 RETURNING value`，同时发起的请求不会互相覆盖（50 个并发请求测试结果正确）。
- 数据库是计数值的唯一可信来源；前端和后端都不缓存计数。

查询实际计数记录：

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, value FROM counter;"'
```

预期输出：

```
 id | value
----+-------
  1 |     0
(1 row)
```

## 10. 数据卷、停止与重新启动

| 项目 | 值 |
| --- | --- |
| Compose 中的卷名 | `counter-db-data` |
| 实际 Docker 卷名 | `lab1-counter_counter-db-data`（Compose 项目名固定为 `lab1-counter`） |
| 挂载目录 | `/var/lib/postgresql/data`（PostgreSQL 16 官方镜像的数据目录） |

```bash
docker compose restart          # 重启全部服务，数据保留
docker compose stop             # 停止但保留容器
docker compose start            # 重新启动已停止的容器
docker compose down             # 删除容器和网络，保留命名卷
docker compose up -d --build    # 重新创建容器，继续使用原有数据
docker volume ls | grep lab1-counter              # 查看数据卷
docker volume inspect lab1-counter_counter-db-data
```

> ⚠️ `docker compose down -v` 会**删除数据卷并清空计数**，持久化验收时不要执行。只有需要彻底重置时才使用它。

## 11. 常见问题排查

| 现象 | 可能原因 | 处理方法 |
| --- | --- | --- |
| `up` 时报 `port is already allocated`，或页面打不开、请求一直等待 | 宿主机端口 `8088` 被其他程序占用 | `lsof -iTCP:8088 -sTCP:LISTEN` 查看占用进程；在 `.env` 中改 `FRONTEND_PORT`，然后执行 `docker compose up -d` |
| `config -q` 报 `请在 .env 中设置 POSTGRES_...` | 没有创建 `.env`，或缺少变量 | 执行 `cp .env.example .env` |
| `backend` 一直是 `health: starting` 或反复重启，日志显示 `db not ready` | 数据库尚未就绪，或连接信息不对 | `docker compose logs db backend`；后端会自动重试约 60 秒。确认 `.env` 中 `POSTGRES_*` 没有被改过 |
| 日志显示 `password authentication failed` | 数据卷已用旧密码初始化，之后修改了 `.env` | 把 `.env` 改回原来的密码；如果确认数据可以丢弃，执行 `docker compose down -v` 后重新 `up` |
| 页面显示 `请求失败（HTTP 502）` | 后端未运行或正在重启 | `docker compose ps -a` 和 `docker compose logs backend`，等待后端变为 healthy |
| 拉取镜像失败（`pull access denied`、`TLS handshake timeout`、`i/o timeout`） | 网络问题或 Docker Hub 访问受限 | 检查网络和代理；在 Docker Desktop → Settings → Docker Engine 中配置 `registry-mirrors`；再执行 `docker compose pull db` 和 `docker compose build --pull` |
| `npm ci` 失败 | npm 源不可访问 | 检查网络，或在 `backend/Dockerfile` 的 `npm ci` 前加 `RUN npm config set registry <镜像源>` |
| `additional_contexts` 不被识别 | Compose 版本太旧 | 升级到 Docker Compose v2.17 或更新版本 |

## 12. 验收记录

见 [docs/validation.md](docs/validation.md)。
