# Waffo 支付接入与上线

## 交付范围与当前状态

本次实现 Waffo 一次性充值、月付/年付订阅、续费与恢复、期末取消、套餐变更确认结账、退款台账、持久化回调、补偿对账、年付每月积分、到期权益回收和后台运维。默认支付渠道仍为 Creem。现有 Creem 订阅按原 provider 处理；不会迁移历史订阅，也不会自动把失败的 Waffo 请求转到 Creem 创建第二笔付款。

当前完成的是本地代码与自动化验证。尚未执行目标数据库迁移、部署、真实 Waffo 沙箱交易或生产开关切换。真实密钥、商店、产品映射和可访问的 HTTPS 地址必须由目标环境配置。离线测试模拟远程 API，不能替代真实接口验收。

参考官方文档：<https://docs.waffo.ai/>，包括 Authentication、Webhooks、Create Checkout Session、Cancel Subscription、Reactivate Order、Issue Session Token、Create Refund Ticket 和 GraphQL Orders & Payments。

## 实现位置

| 范围 | 位置 | 行为 |
| --- | --- | --- |
| 新购买渠道 | `packages/server/src/lib/payments/routing.ts` | 充值/订阅独立选择渠道，缺省继承 `PAYMENT_PROVIDER`，默认 Creem |
| Waffo 业务 | `packages/server/src/lib/payments/providers/waffo/` | 签名、结账、订阅、事件、退款与对账 |
| 持久化 | `packages/server/src/lib/db/schema/waffo.ts` | 四张独立台账/收件箱表，金额保留四位小数 |
| 迁移 | `drizzle/20261021000000_waffo_payments.sql` | 仅创建 Waffo 表、索引及新表外键，不修改既有表结构 |
| 回调 | `POST /api/pay/callback/waffo` | 验证原始请求签名及商店/环境，落库后确认接收 |
| 运维 | `/admin/payments/waffo` | 失败事件重放、订单异常、发起退款和记录积分复核决定 |
| 补偿 | `packages/server/src/lib/trigger/tasks/process-waffo-payments.ts` | 即时消费；生产环境每两分钟对账、重试、到期与年付积分处理 |
| 手动调度 | `POST /api/internal/payments/waffo` | `Authorization: Bearer <CRON_SECRET>`，用于沙箱/运维调用 |
| 用户界面 | 订阅设置、订单历史、付款返回处理 | 服务端确认到账后显示成功；展示实收、税费和退款明细 |

## Creem 隔离与回退

1. 保持 `PAYMENT_PROVIDER=creem`，原有 `CREEM_*` 配置不变。通过 `PAYMENT_ONE_TIME_PROVIDER`、`PAYMENT_SUBSCRIPTION_PROVIDER` 只控制新的购买。
2. 取消、恢复和套餐变更按数据库已有订阅的 provider 分派，不按当前购买开关分派。Creem 回调与订阅服务保留原路径；原年付任务排除 Waffo，避免双方重复发放。
3. Waffo 参数缺失或映射异常不会在 Creem 全局初始化时抛错；只有选中 Waffo 的结账会失败。
4. 用户已有任一渠道的有效/逾期/暂停订阅时，不允许另开 Waffo 订阅。已有 Waffo 待确认订阅时也阻止重复购买；未知远程结果不能单凭本地超时认定已关闭。
5. 回退时将两个新购买渠道切回 `creem`，并设置 `WAFFO_ENABLED=false`。**保留 `WAFFO_OPERATIONS_ENABLED=true`、回调、密钥、数据库表及维护任务**，直到所有已有 Waffo 付款、订阅、退款处理完毕。回退不撤销已完成支付。

## 环境配置

模板见根目录 `.env.waffo.example`，不要直接使用占位产品 ID。API 与 Trigger worker 必须使用一致的商店、环境及数据库。前端不接收私钥。

| 参数 | 配置要求 |
| --- | --- |
| `WAFFO_ENABLED` | 仅新结账开关；默认关闭 |
| `WAFFO_OPERATIONS_ENABLED` | 事件消费及维护开关；新结账要求同时开启；回退后仍保留 |
| `WAFFO_ENV` | `test` 或 `production`；内部事件对应 `test` / `prod` |
| `WAFFO_STORE_ID` | 当前环境商店 ID，回调和本地订单必须匹配 |
| `WAFFO_MERCHANT_ID` | 商户 ID，签名请求使用 |
| `WAFFO_PRIVATE_KEY` | 商户 RSA 私钥，支持 PEM 或转义换行；仅放密钥管理器 |
| `WAFFO_WEBHOOK_PUBLIC_KEY` | Waffo 回调验签公钥，与商户私钥用途不同 |
| `WAFFO_PACKS` | 两个充值包；可按 `productId:tier` 配置覆盖映射 |
| `WAFFO_SUBSCRIPTIONS` | 三个等级各月付/年付，共六个产品映射 |
| `PAYMENT_SUCCESS_BASE_URL` | 实际可访问的 Web HTTPS 基址 |
| `CRON_SECRET` | 手动维护接口鉴权；不能放入浏览器配置 |

新结账发送服务端价格快照，不接受浏览器传入的价格。商品币种、周期与当地 Waffo 商品设置应逐项一致。签名商户请求由密钥绑定环境，不额外发送环境头；客户 token 请求按照客户接口要求带环境。

## 数据一致性与业务规则

- 回调按环境、商店、事件类型与事件 ID 去重。验签使用原始 body；时间容差 45 分钟以覆盖官方原签名重试。落库失败返回失败响应，避免事件丢失。
- 事件处理在事务内完成，积分失败会回滚付款台账与订单状态；失败按指数退避重试，八次后进入后台失败队列。所有写 API 不自动重试，超时属于结果未知，先对账。
- 一次性充值按本地购买快照核对币种和未税标价，再按本地 order ID 幂等发放。税费、标价和实收分别存储，不能用实收直接等同标价。
- 订阅付款事件不包含完整周期。周期事件与对应 `periodNumber` 的成功付款齐备后才发放；两者可以任意顺序到达。未知周期或零额验卡不会直接授予付费权益。
- 取消保留已付费周期。到达本地已付费结束时间，即使缺失终止回调也回收订阅积分；续费补偿确认后可恢复。维护周期为两分钟，应按此设置监控时效。
- 年付按月清理旧订阅余额并发放当月额度，月末日期自动收敛；停机恢复只补当前月，不叠加已过期月份。既有 Creem 年付任务不处理 Waffo。
- 升级立即结账确认；降级或额度降低的周期变更在下一周期确认。最终应付与折抵以 Waffo 结账为准，不在本地伪造差价。新订单付款生效后替换原订阅。
- 已确认的计划变更会使原订阅停止续费；取消新计划**不会自动恢复原订阅续费**，界面已提示。需要恢复时按 Waffo 当前状态处理，不能承诺远程不支持的撤销。
- 实际退款按 refund ID 记账；支持分次部分退款，累计不得超过已知实收，未知请求尚未核实时阻止再次退款。退款 API 先保留本地请求，回调可早于 HTTP 响应到达。
- 自动回收仅限可证明“账户只有这一笔未消费充值”的全额退款。部分退款、积分混用、订阅退款进入人工审核，避免误扣其他购买或 Creem 权益。后台“完成复核”只记录审计意见，实际人工调账使用现有积分管理审计流程。
- 远程关闭不等于付款已退款；退款也不等于订阅已取消，应分别操作。

## 部署顺序

1. 在隔离沙箱环境配置 Waffo 真实测试密钥和商品。保持两个新购买渠道为 Creem；Waffo 新结账关闭。
2. 备份并确认目标数据库迁移历史，审阅本次新增 SQL，再使用项目的 Drizzle 迁移流程在沙箱应用。不要执行 `db:push` 替代审阅迁移。正式环境另行按发布流程执行 `pnpm db:migrate:prod`，此命令会修改数据库，本次尚未运行。
3. 部署 API、Web 和 Trigger worker。确认 `billing-process-waffo-inbox`、`billing-process-waffo-payments` 均存在且环境变量一致。Trigger 定时任务只在 PRODUCTION 环境自动执行，测试环境可调用受保护手动维护接口。
4. 在 Waffo 控制台配置公网 API 地址 `https://<api-domain>/api/pay/callback/waffo`，订阅以下事件：`order.completed`、`subscription.activated`、`subscription.payment_succeeded`、`subscription.renewed`、`subscription.recovered`、`subscription.canceling`、`subscription.uncanceled`、`subscription.canceled`、`subscription.past_due`、`subscription.plan_changed`、`subscription.plan_change_scheduled`、`subscription.plan_change_failed`、`refund.succeeded`、`refund.failed`。
5. 开启沙箱维护与结账开关，先把充值路由切到 Waffo，完成下表；再验证订阅。不能把官方“发送样例回调”视为真实交易验收，样例没有可关联的本地订单。
6. 沙箱验收后，再配置生产密钥/映射并按相同顺序发布、验证维护任务，分阶段切换生产新充值和新订阅。整个过程中保留 Creem 回调和配置。

## 必须完成的真实沙箱验收

| 场景 | 验收结果 |
| --- | --- |
| Creem 新充值/订阅、历史续费/取消/恢复 | 与发布前行为一致；付款与积分仅记一次 |
| Waffo 充值，含等级优惠和税费 | 本地标价、币种、实际实收及积分一致；返回原工具页面 |
| 重复签名回调、乱序付款/周期回调 | 无重复积分、无期间倒退 |
| 月付/年付首次购买与续费 | 对应成功付款和周期后才开通；年付每月仅发一次 |
| 取消/恢复，回调延迟、到期未续费 | 已付周期保留，到期回收；恢复/续费准确反映远程状态 |
| 即时升级、下周期降级、月年切换 | 最终差价由 Waffo 展示；旧订阅不再续费；没有两份权益 |
| 套餐确认失败、取消已确认计划 | 旧权益不误删；界面准确提示旧订阅续费状态 |
| 部分、多次及全额退款，混用积分 | 金额不超实收，状态准确；可证明隔离时回收，否则人工审核 |
| 断网造成结账/退款响应未知 | 不重复创建扣款；补偿对账或人工核实后恢复 |
| 屏蔽回调后主动对账 | 补回付款/退款与订阅状态，已退款购买不发积分 |
| API、Worker 重启，事务故障 | 收件箱不丢失，重放不重复发放 |
| 修改订单 ID、商店、环境、签名 | 不泄露他人订单、不跨环境处理 |

特别核实 GraphQL 的集合/过滤参数、付款 `amount { display currency }`、`snapshotAmountDetails` 数值单位、退款 `pspAmountDetails`、取消/恢复以及客户 token 的实际返回契约。官方不同页面存在字段/单位说明差异；当前对账按文档结构严格处理，不擅自除以 100 或四舍五入。若真实契约不同，先修正映射并回归，才能开启生产结账。官方零额扣款或渠道未报告实收的特殊情况，需要核实付款语义后处理，不能把标价当作已收款。

## 运维与限制

监控 Trigger 运行失败、待处理最老事件、八次失败事件、长期 `pending` 订单、`reviewReason`、未知退款请求和远程/本地订阅差异。建议待处理超过五分钟即通知值班人员，调度停摆必须单独告警。Trigger 通知渠道需在目标环境配置，本次没有向外部发送消息。

补偿默认每轮轮询十个订单，每个订单付款分页上限一万条；商店历史增长后需按积压量调整批量、归档/分区或独立增量游标，并以平台限流情况验证任务时长。后台列表每类显示最近一百条；历史完整核对需查询数据库和 Waffo。

未知结账且远程查不到订单时进入人工审核，不自动当作无付款并释放重复订阅限制。必须先在 Waffo 核实并关闭远程可支付订单，再通过审计流程处理本地订单。通过外部 Waffo 门户创建、缺少本地业务引用的套餐变更不自动关联用户，进入事件失败队列人工核实。

## 本地验证

`pnpm test:payments` 使用临时内存 PostgreSQL 兼容数据库 PGlite、真实事务和唯一约束；远程 Waffo/Creem API 为模拟，不访问生产数据库。包括 Creem 回归、RSA 签名、事务回滚、幂等、乱序、退款、年度积分、套餐替换、对账和鉴权。

类型检查命令：`pnpm exec tsc --noEmit --incremental false -p apps/api/tsconfig.json` 与 Web 同路径配置。UTF-8 检查通过。全仓 i18n fallback 检查仍有九处既有问题，位于 marketing、settings-sidebar、sse、transcriptions，未为本次支付工作改写基线。

最终本地验证结果：27 项支付测试全部通过；测试先还原上一版数据库结构，再实际执行本次新增迁移，并核对迁移快照与当前 schema 无差异。API/Web 类型检查与核心改动定向 ESLint 通过。`pnpm run build:api` 和 `pnpm exec next build ./apps/web --webpack` 均成功。

全仓硬编码扫描未通过，报告 300 个疑似项，包含既有文案及后台/内部日志、状态枚举等匹配；未通过调整扫描基线隐藏这些结果。本次新增付款与订阅界面文案使用英文 i18n 字典，类型同步添加。
