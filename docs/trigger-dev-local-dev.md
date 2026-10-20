# Trigger.dev 使用说明

本文档说明当前项目中 Trigger.dev 的接入方式，以及三种测试/部署路径的用途与用法。

## 当前架构

Trigger.dev 负责 **3 个定时维护任务**：

| Task ID | 作用 | Cron (UTC) |
|---------|------|------------|
| `cleanup-expired-anonymous-transcriptions` | 清理过期匿名转录及 R2 文件 | `0 */12 * * *`（每 12 小时） |
| `process-yearly-subscription-grants` | 年付订阅按月发放积分 | `7 * * * *`（每小时 :07） |
| `cleanup-expired-transcription-failure-archives` | 清理过期失败归档及匿名失败媒体 | `30 0 * * 1`（每周一 00:30） |

生产主链路：

1. Trigger.dev schedule 触发 task
2. task 直接调用 `packages/server` 里的业务 service
3. service 访问数据库 / R2 等执行真实逻辑

`/api/internal/...` 内部路由保留为 **fallback**，不是常规生产入口。

## 相关文件

- Trigger 配置：`trigger.config.ts`
- Task 定义：`packages/server/src/lib/trigger/tasks/`
- Task ID：`packages/shared/src/lib/trigger/task-ids.ts`
- 业务 service：
  - `packages/server/src/lib/transcriptions/service.ts`
  - `packages/server/src/lib/subscriptions/yearly-credit-grant.ts`
  - `packages/server/src/lib/transcriptions/failure-archive.ts`
- Fallback 内部路由：
  - `apps/api/src/app/api/internal/transcriptions/cleanup-expired/route.ts`
  - `apps/api/src/app/api/internal/subscriptions/yearly-grants/route.ts`
  - `apps/api/src/app/api/internal/transcriptions/cleanup-failure-archives/route.ts`

所有 schedule task 均配置了 `concurrencyLimit: 1`、`maxAttempts: 3`，且 **仅在 `PRODUCTION` 环境自动按 cron 触发**。

---

## 三种方式对比

| | 方式 1：本地测试 | 方式 2：部署到 Production | 方式 3：Fallback 测试 |
|---|---|---|---|
| **作用** | 开发阶段验证 task 逻辑 | 将 task 发布到 Trigger 云端并上线 | 绕过 Trigger，直接测业务 service |
| **代码在哪跑** | 本机 dev worker | Trigger.dev 云端 | 本机或 API 服务器 |
| **是否更新线上 task 版本** | 否 | 是 | 否 |
| **cron 是否自动跑** | 否 | 是（deploy 到 Production 后） | 否（需手动 HTTP 调用） |
| **环境变量来源** | `.env.api.local` | Trigger.dev 控制台 Production 环境变量 | API 进程加载的 env 文件 |
| **典型场景** | 改代码后立即试跑 | 首次上线 / 手动发布 | 应急补跑、本地调试 service |

---

## 方式 1：本地测试（dev worker）

### 作用

- 在开发阶段验证 task 能否正确调用业务 service
- 配合 Trigger.dev 控制台 **手动 Run**，快速迭代代码
- **不会**更新 Production 上的 task 版本，**不会**触发 cron

### 环境变量

在 `.env.api.local` 中配置：

```bash
TRIGGER_PROJECT_REF=proj_xxx
TRIGGER_SECRET_KEY=tr_dev_xxx    # 开发 key，不要用 tr_prod_
CRON_SECRET=your_local_cron_secret   # 仅方式 3 需要
```

### 用法

```powershell
# 终端 1：启动 API
pnpm run dev:api

# 终端 2：启动 Trigger.dev 本地 worker
pnpm run dev:trigger
```

然后在 Trigger.dev 控制台找到对应 task，点击 **Run** 手动触发。

### 注意

- 不要直接运行 `npx trigger.dev@latest dev`，该命令不会加载 `.env.api.local`，会导致 `TRIGGER_PROJECT_REF` 缺失。
- 本地 **不会** 自动按 cron 运行，因为 task 配置了 `environments: ["PRODUCTION"]`。
- 不要等待 cron 自动触发；应在控制台手动 Run。

---

## 方式 2：部署到 Trigger.dev Production

### 作用

- 将 task 代码打包并发布到 Trigger.dev **Production** 环境
- 注册 3 个 schedule task，之后由 Trigger 云端按 cron 自动调度
- 效果与 push 到 `main` 触发 GitHub 自动 deploy 相同

### 部署前检查

**1. Trigger.dev 控制台 → Production → Environment variables**

task **运行时**读取这里的变量（不会自动读取本机 `.env.api.production`）：

```bash
TRIGGER_PROJECT_REF=proj_xxx
TRIGGER_SECRET_KEY=tr_prod_xxx

DATABASE_URL=...
R2_ENDPOINT=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_DOMAIN=assets.mp3totext.io
R2_METADATA_SOURCE=mp3totext
```

**2. 本机 `.env.api.production`**

至少包含 deploy 认证用的变量（需使用 **生产 key** `tr_prod_...`，不要用 `tr_dev_...`）：

```bash
TRIGGER_PROJECT_REF=proj_xxx
TRIGGER_SECRET_KEY=tr_prod_xxx
```

### 用法（方案 A：pnpm exec）

PowerShell 中 `dotenv` 不是全局命令，需通过 `pnpm exec` 调用项目内安装的 `dotenv-cli`：

```powershell
cd e:\WebProject\mp3totextio

# 可选：确保依赖完整
pnpm install

# 部署到 Production（默认环境为 prod）
pnpm run trigger:deploy:prod:dry

# 确认 dry-run 构建成功后，再执行正式生产部署
pnpm run trigger:deploy:prod
```

### 部署后验证

1. **Deploys** 页出现 successful deploy 记录
2. **Tasks** 页可见 3 个 task
3. **Runs** 页手动 Run 一次，确认执行成功
4. 确认 Trigger 控制台中的 `DATABASE_URL` 指向预期环境（Production deploy 会操作生产数据）

### GitHub 自动 deploy（可选）

若已在 Trigger.dev 连接 GitHub 仓库并设置 Production 分支为 `main`，则 push 到 `main` 也会自动 deploy，无需每次本地执行上述命令。

构建配置建议：

| 配置项 | 值 |
|--------|-----|
| Trigger config file | `trigger.config.ts` |
| Install command | `pnpm install --frozen-lockfile` |

### API 服务器侧（可选）

`.env.api.production` 中的 `TRIGGER_*` 不影响 task 调度，但 Admin 系统页会用来显示「Trigger 是否已配置」。若保留 fallback 路由，建议同时配置：

```bash
CRON_SECRET=your_production_cron_secret
```

---

## 方式 3：Fallback 测试（内部 HTTP 路由）

### 作用

- **不经过 Trigger.dev**，直接调用与 task 相同的业务 service
- 适合：本地调试 service 逻辑、手工补跑、Trigger 故障时的应急运维
- **不是**常规生产调度入口

### 环境变量

API 进程需加载包含 `CRON_SECRET` 的 env 文件（本地用 `.env.api.local`，生产用 `.env.api.production`）。

### 用法

先启动 API：

```powershell
pnpm run dev:api
```

**PowerShell 示例：**

```powershell
$secret = "你的 CRON_SECRET"

# 清理过期匿名转录
Invoke-WebRequest -Method POST `
  -Uri "http://localhost:3001/api/internal/transcriptions/cleanup-expired" `
  -Headers @{ Authorization = "Bearer $secret" }

# 年付订阅按月发积分
Invoke-WebRequest -Method POST `
  -Uri "http://localhost:3001/api/internal/subscriptions/yearly-grants" `
  -Headers @{ Authorization = "Bearer $secret" }

# 清理过期失败归档
Invoke-WebRequest -Method POST `
  -Uri "http://localhost:3001/api/internal/transcriptions/cleanup-failure-archives" `
  -Headers @{ Authorization = "Bearer $secret" }
```

**curl 示例（Git Bash / WSL）：**

```bash
curl -X POST http://localhost:3001/api/internal/transcriptions/cleanup-expired \
  -H "Authorization: Bearer $CRON_SECRET"

curl -X POST http://localhost:3001/api/internal/subscriptions/yearly-grants \
  -H "Authorization: Bearer $CRON_SECRET"

curl -X POST http://localhost:3001/api/internal/transcriptions/cleanup-failure-archives \
  -H "Authorization: Bearer $CRON_SECRET"
```

生产环境 fallback 时，将 `localhost:3001` 替换为 `https://api.mp3totext.io`，并确保 `CRON_SECRET` 与 API 服务器配置一致。

### 注意

- 只有明确需要测试 service 或应急运维时才调用这些路由。
- 若 API 连接的是生产数据库，fallback 调用会 **直接修改生产数据**。

---

## 架构边界

| 组件 | 职责 |
|------|------|
| Trigger.dev | 调度、重试、云端运行时、可观测性 |
| server service | 真实业务逻辑（DB / R2 操作） |
| internal cron 路由 | 仅 fallback：手工补跑、本地调试、应急 |

Task 已直接调用 server service，**不再需要** `INTERNAL_API_BASE_URL`。

---

## 推荐流程

```text
开发阶段     → 方式 1（dev:api + dev:trigger + 控制台手动 Run）
准备上线     → 方式 2（pnpm exec dotenv deploy 到 Production）
验证 service → 方式 3（fallback 内部路由，可选）
日常更新     → push 到 main（GitHub 自动 deploy）或重复方式 2
```
