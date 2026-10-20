import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core"
import { users } from "./users"
import { SUBSCRIPTION_STATUS } from "@markless/shared/src/constants/subscription"

/**
 * 用户订阅表 (User Subscriptions)
 * 记录用户的核心订阅状态、套餐信息及支付关联
 */
export const userSubscriptions = pgTable("user_subscriptions", {
  id: text("id").primaryKey().notNull(), // 记录ID
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }), // 关联用户ID
  
  // 订阅计划信息
  planId: text("plan_id").notNull(), // 套餐标识ID (例如: "pro:monthly", "tier2:yearly")
  planName: text("plan_name").notNull(), // 套餐显示名称
  
  // 订阅状态
  status: text("status").notNull().default(SUBSCRIPTION_STATUS.ACTIVE),
  // "active"      - 正常活跃
  // "expired"     - 已过期（权益失效）
  // "past_due"    - 扣款失败，逾期未付
  // "paused"      - 暂停（功能保留或冻结）
  
  // 支付提供商信息
  provider: text("provider").notNull(), // 支付平台: "stripe", "creem"
  providerSubscriptionId: text("provider_subscription_id").notNull(), // 支付平台的订阅对象ID (用于Webhook关联)
  providerCustomerId: text("provider_customer_id"), // 支付平台的客户ID
  
  // 订阅周期管理
  interval: text("interval").notNull(), // 计费周期: "month", "year"
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(), // 当前周期开始时间
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(), // 当前周期结束时间 (也是下次续费时间)
  
  // 积分发放配置
  creditsPerPeriod: integer("credits_per_period").notNull(), // 每个周期应发放的积分总数
  lastCreditGrantAt: timestamp("last_credit_grant_at", { withTimezone: true }), // 上次成功发放积分的时间
  creditGrantCount: integer("credit_grant_count").default(0).notNull(), // 当前大周期内已发放次数（主要用于年付计划每月发放的追踪）
  
  // 取消逻辑
  cancelAt: timestamp("cancel_at", { withTimezone: true }), // 预定取消生效的时间点
  cancelAtPeriodEnd: integer("cancel_at_period_end").default(0).notNull(), // 标记: 是否在周期结束后自动取消 (1=是, 0=否)
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }), // 用户执行取消操作的时间
  
  // 计划变更预约（用于降级或预约切换）
  scheduledPlanId: text("scheduled_plan_id"), // 预约切换的目标套餐ID
  scheduledPlanName: text("scheduled_plan_name"), // 预约切换的目标套餐名称
  scheduledCreditsPerPeriod: integer("scheduled_credits_per_period"), // 目标套餐的积分数
  scheduledInterval: text("scheduled_interval"), // 目标套餐的周期
  scheduledChangeAt: timestamp("scheduled_change_at", { withTimezone: true }), // 预约生效时间（通常是 currentPeriodEnd）
  scheduledChangeType: text("scheduled_change_type"), // 变更类型: "upgrade" | "downgrade"
  
  // 周期内变更限制与统计
  cycleChangeCount: integer("cycle_change_count").default(0).notNull(), // 当前周期内已变更套餐的次数（用于限制频繁切换）
  lastPlanChangeAt: timestamp("last_plan_change_at", { withTimezone: true }), // 上次变更套餐的时间
  
  // 时间戳
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), // 记录创建时间
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(), // 记录更新时间
})

// Drizzle 类型定义
export type UserSubscription = typeof userSubscriptions.$inferSelect
export type NewUserSubscription = typeof userSubscriptions.$inferInsert

// 订阅状态枚举类型
export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS]
