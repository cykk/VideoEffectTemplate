import { pgTable, text, timestamp, integer, json } from "drizzle-orm/pg-core"
import { users } from "./users"
import { orders } from "./orders"
import { nanoid } from "nanoid"

/**
 * 用户积分账户表 (User Credits)
 * 记录每个用户的积分余额信息，按来源分类管理
 */
export const userCredits = pgTable("user_credits", {
  id: text("id").primaryKey().notNull().$defaultFn(() => nanoid()), // 记录ID (使用 nanoid 生成)
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(), // 关联用户ID，每个用户唯一

  // 积分余额分类（按来源）
  subscriptionCredits: integer("subscription_credits").default(0).notNull(), // 订阅积分 (通常有有效期，随订阅周期重置)
  purchasedCredits: integer("purchased_credits").default(0).notNull(), // 充值积分 (永久有效)
  bonusCredits: integer("bonus_credits").default(0).notNull(), // 赠送/奖励积分 (可能有有效期)

  // 总计字段
  totalBalance: integer("total_balance").default(0).notNull(), // 当前可用总积分 (上述三项之和)

  // 统计字段
  totalEarned: integer("total_earned").default(0).notNull(), // 历史累计获得积分
  totalSpent: integer("total_spent").default(0).notNull(), // 历史累计消费积分

  // ✅ P0: 乐观锁版本号，防止并发扣除
  version: integer("version").default(0).notNull(),

  // 时间戳
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), // 创建时间
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(), // 更新时间
})

/**
 * 积分交易记录表 (Credit Transactions)
 * 记录每一次积分的增减变动，用于审计和账单
 */
export const creditTransactions = pgTable("credit_transactions", {
  id: text("id").primaryKey().notNull().$defaultFn(() => nanoid()), // 交易ID (使用 nanoid 生成)
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }), // 关联用户ID

  // 交易类型定义
  type: text("type").notNull(),
  // "subscription_grant" - 订阅周期发放
  // "purchase" - 用户充值购买
  // "bonus" - 系统奖励/赠送
  // "usage" - 消费使用
  // "expire" - 积分过期扣除
  // "refund" - 退款扣回
  // "adjustment" - 管理员/系统调整

  amount: integer("amount").notNull(), // 变动数量 (正数表示增加，负数表示减少)
  balanceAfter: integer("balance_after").notNull(), // 变动后的账户总余额

  // 来源关联信息
  source: text("source"), // 来源分类: "subscription", "one_time", "bonus", "usage"
  orderId: text("order_id").references(() => orders.id), // 关联订单ID (如果是充值)
  subscriptionId: text("subscription_id"), // 关联订阅ID (如果是订阅发放)
  idempotencyKey: text("idempotency_key").unique(), // 幂等键（防止重复发放）

  // 有效期控制
  expiresAt: timestamp("expires_at", { withTimezone: true }), // 该笔积分的过期时间 (仅用于发放记录)

  // 描述和元数据
  description: text("description"), // 人类可读的交易描述
  metadata: json("metadata"), // 其他元数据 (如关联的任务ID等)

  // 时间戳
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), // 交易时间
})

// Drizzle 类型推断
export type UserCredit = typeof userCredits.$inferSelect
export type NewUserCredit = typeof userCredits.$inferInsert

export type CreditTransaction = typeof creditTransactions.$inferSelect
export type NewCreditTransaction = typeof creditTransactions.$inferInsert
