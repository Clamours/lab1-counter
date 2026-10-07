# 验收记录

> 说明：下文“命令输出”一节是开发阶段在本机实际运行的结果，其中“点击 +/−”一步用 `curl` 调用对应接口代替，页面按钮调用的正是这些接口。
> 正式验收时，由一名组员在未部署过本项目的环境中从 CodeArts 克隆提交版本，**用浏览器操作页面**，按以下步骤重做一遍，并把截图放到 `docs/images/`，替换或补充下文的结果。

## 0. 基本信息

| 项目 | 内容 |
| --- | --- |
| CodeArts 项目名称 | （填写） |
| 代码仓库链接 | （填写） |
| 被验收分支 / Commit SHA | `main` / `（填写 git rev-parse HEAD 的完整输出）` |
| 验收人 | （填写） |
| 操作系统 | macOS 14.4（开发预检环境；正式验收请填写实际环境） |
| Docker / Compose 版本 | Docker 29.4.0 / Docker Compose v5.1.2 |

获取版本信息：

```bash
git rev-parse HEAD
docker version --format 'Docker {{.Server.Version}}'
docker compose version
```

### CodeArts 项目与权限证据

- [ ] 截图：CodeArts 项目成员列表，能看到全部组员和助教 → `images/codearts-members.png`
- [ ] 截图：代码仓库成员 / 权限配置 → `images/codearts-repo-permission.png`

![CodeArts 成员](images/codearts-members.png)
![仓库权限](images/codearts-repo-permission.png)

## 1. 结果汇总

| 类别 | 操作 | 预期 | 实际 | 结论 |
| --- | --- | --- | --- | --- |
| 首次启动 | `config -q` 后 `up -d --build`，打开页面 | 三个服务运行，初始值 `0` | 三个服务 `Up (healthy)`，值 `0` | ✅ |
| 加减与负数 | 从 0 开始 +3、−1，再 −3 | 先显示 `2`，再显示 `-1`；数据库中为 `-1` | 显示 `2`，然后 `-1`；数据库 `value = -1` | ✅ |
| 刷新与跨浏览器 | 刷新页面，用无痕窗口访问 | 均显示 `2`（第 2 步之后为 `-1`） | 读取结果为 `2`，然后 `-1` | ✅（浏览器截图待补） |
| 服务重启 | `docker compose restart` 后刷新，再 +1 | 先 `-1`，然后 `0` | 先 `-1`，然后 `0` | ✅ |
| 删除重建 | 连续 +7 → `down` → `up -d --build` → −1 | 重建后 `7`，然后 `6`；数据库一致 | 重建后 `7`，然后 `6`；数据库 `7`，然后 `6` | ✅ |

## 2. 验收步骤与命令输出

### 5.1 从干净环境启动

```bash
cp .env.example .env
docker compose config -q
docker compose up -d --build
docker compose ps -a
```

```
$ docker compose config -q
(exit 0)
$ docker compose ps -a
NAME                      IMAGE                   COMMAND                  SERVICE    CREATED          STATUS                    PORTS
lab1-counter-backend-1    lab1-counter-backend    "docker-entrypoint.s…"   backend    23 seconds ago   Up 16 seconds (healthy)   3000/tcp
lab1-counter-db-1         postgres:16.4-alpine    "docker-entrypoint.s…"   db         23 seconds ago   Up 22 seconds (healthy)   5432/tcp
lab1-counter-frontend-1   lab1-counter-frontend   "/docker-entrypoint.…"   frontend   22 seconds ago   Up 10 seconds (healthy)   0.0.0.0:8088->80/tcp, [::]:8088->80/tcp
GET /api/counter -> {"value":0}
```

结果：配置校验通过，三个服务都是 healthy。访问 <http://localhost:8088>，初始值为 `0`。

- [ ] 截图：`images/5.1-ps.png`（`ps -a` 输出）、`images/5.1-page-0.png`（页面显示 0）

### 5.2 验证功能及数据库写入

1. 从 `0` 开始，点击 `+` 三次，再点击 `−` 一次：

```
+ -> {"value":1}
+ -> {"value":2}
+ -> {"value":3}
- -> {"value":2}
```

2. 刷新页面，再用另一个浏览器或无痕窗口访问：

```
refresh GET -> {"value":2}
```

3. 点击 `−` 三次，然后刷新：

```
- -> {"value":1}
- -> {"value":0}
- -> {"value":-1}
refresh GET -> {"value":-1}
```

4. 查询数据库：

```
$ docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, value FROM counter;"'
 id | value
----+-------
  1 |    -1
(1 row)
```

- [ ] 截图：`images/5.2-page-2.png`、`images/5.2-incognito-2.png`、`images/5.2-page-neg1.png`、`images/5.2-db-neg1.png`

### 5.3 验证服务重启

```bash
docker compose restart
docker compose ps -a
```

```
$ docker compose restart
 Container lab1-counter-db-1 Restarting
 Container lab1-counter-frontend-1 Restarting
 Container lab1-counter-backend-1 Restarting
 Container lab1-counter-frontend-1 Started
 Container lab1-counter-backend-1 Started
 Container lab1-counter-db-1 Started
$ docker compose ps -a        # 约 10 秒后
NAME                      IMAGE                   COMMAND                  SERVICE    CREATED          STATUS                    PORTS
lab1-counter-backend-1    lab1-counter-backend    "docker-entrypoint.s…"   backend    34 seconds ago   Up 10 seconds (healthy)   3000/tcp
lab1-counter-db-1         postgres:16.4-alpine    "docker-entrypoint.s…"   db         34 seconds ago   Up 10 seconds (healthy)   5432/tcp
lab1-counter-frontend-1   lab1-counter-frontend   "/docker-entrypoint.…"   frontend   33 seconds ago   Up 10 seconds (healthy)   0.0.0.0:8088->80/tcp, [::]:8088->80/tcp
GET -> {"value":-1}
+ -> {"value":0}
```

结果：服务恢复后刷新，页面仍为 `-1`；点击 `+` 后变为 `0`，说明重启后仍能写入数据库。

- [ ] 截图：`images/5.3-ps.png`、`images/5.3-page-neg1.png`、`images/5.3-page-0.png`

### 5.4 验证删除容器后重建

1. 继续点击 `+` 七次，计数变为 `7`，然后查询数据库：

```
+ -> {"value":1}  …  + -> {"value":7}
 id | value
----+-------
  1 |     7
(1 row)
```

2. 保存容器列表，然后删除本项目容器：

```
$ docker compose ps -a        # 删除前
NAME                      IMAGE                   COMMAND                  SERVICE    CREATED          STATUS                    PORTS
lab1-counter-backend-1    lab1-counter-backend    "docker-entrypoint.s…"   backend    34 seconds ago   Up 10 seconds (healthy)   3000/tcp
lab1-counter-db-1         postgres:16.4-alpine    "docker-entrypoint.s…"   db         34 seconds ago   Up 10 seconds (healthy)   5432/tcp
lab1-counter-frontend-1   lab1-counter-frontend   "/docker-entrypoint.…"   frontend   33 seconds ago   Up 10 seconds (healthy)   0.0.0.0:8088->80/tcp, [::]:8088->80/tcp
$ docker compose down
 Container lab1-counter-frontend-1 Removed
 Container lab1-counter-backend-1 Removed
 Container lab1-counter-db-1 Removed
 Network lab1-counter_default Removed
$ docker compose ps -a        # 删除后：容器已全部移除
NAME      IMAGE     COMMAND   SERVICE   CREATED   STATUS    PORTS
$ docker volume ls --filter name=lab1-counter   # 命名卷仍然保留
DRIVER    VOLUME NAME
local     lab1-counter_counter-db-data
```

3. 重新构建并启动：

```
$ docker compose up -d --build
$ docker compose ps -a        # 容器已重新创建（CREATED 时间刷新）
NAME                      IMAGE                   COMMAND                  SERVICE    CREATED          STATUS                    PORTS
lab1-counter-backend-1    lab1-counter-backend    "docker-entrypoint.s…"   backend    21 seconds ago   Up 16 seconds (healthy)   3000/tcp
lab1-counter-db-1         postgres:16.4-alpine    "docker-entrypoint.s…"   db         22 seconds ago   Up 21 seconds (healthy)   5432/tcp
lab1-counter-frontend-1   lab1-counter-frontend   "/docker-entrypoint.…"   frontend   21 seconds ago   Up 10 seconds (healthy)   0.0.0.0:8088->80/tcp, [::]:8088->80/tcp
```

4. 服务就绪后，在新开的无痕窗口访问页面，并查询数据库：

```
GET -> {"value":7}
 id | value
----+-------
  1 |     7
(1 row)
```

5. 点击 `−` 一次，然后刷新并查询数据库：

```
- -> {"value":6}
refresh GET -> {"value":6}
 id | value
----+-------
  1 |     6
(1 row)
```

数据卷信息：

```
$ docker volume inspect lab1-counter_counter-db-data
"Name": "lab1-counter_counter-db-data",
"Labels": { "com.docker.compose.project": "lab1-counter", "com.docker.compose.volume": "counter-db-data" },
"Mountpoint": "/var/lib/docker/volumes/lab1-counter_counter-db-data/_data"
```

结论：新容器继续使用原有命名卷中的数据。全程没有执行 `docker compose down -v`，也没有手工修改数据库或重新导入计数。

- [ ] 截图：`images/5.4-db-7.png`、`images/5.4-ps-before.png`、`images/5.4-ps-after-down.png`、`images/5.4-ps-rebuilt.png`、`images/5.4-incognito-7.png`、`images/5.4-page-6.png`、`images/5.4-db-6.png`

## 3. 额外检查（可选）

| 检查项 | 结果 |
| --- | --- |
| 50 个并发 `increment` 请求 | 计数从 `6` 变为 `56`，没有丢失更新（原子 `UPDATE ... RETURNING`） |
| 停止 backend 后访问接口 | Nginx 立即返回 `502`，页面显示“请求失败（HTTP 502），请稍后重试。” |
| 单独重建 backend 容器（`up -d --force-recreate backend`） | 前端通过 Docker DNS 重新解析 backend，无需重启前端即可恢复 |
