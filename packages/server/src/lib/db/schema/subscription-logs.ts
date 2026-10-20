import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core"
import { users } from "./users"

/**
 * 订阅变更日志表 (Subscription Logs)
 * 记录订阅状态的所有变更历史，用于审计、客服查询和数据分析
 */
export const subscriptionLogs = pgTable("subscription_logs", {
  id: serial("id").primaryKey(), // 自增主键
  
  // 关联信息
  subscriptionId: text("subscription_id")
    .notNull(),
    // 注意：这里不使用数据库层面的外键约束，以防订阅主记录被物理删除后日志也随之丢失
    // 业务逻辑上它关联 userSubscriptions.id
  
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }), // 关联用户ID
  
  // 变更动作类型
  action: text("action").notNull(), 
  // 常见值:
  // 'create'         - 创建新订阅
  // 'renew'          - 周期自动续费
  // 'upgrade'        - 升级套餐
  // 'downgrade'      - 降级套餐 (通常指预约降级)
  // 'cancel_scheduled' - 预约取消 (到期结束)
  // 'cancel_immediate' - 立即取消
  // 'reactivate'     - 恢复/重新激活
  // 'expire'         - 订阅过期
  // 'payment_failed' - 扣款失败
  
  // 变更前状态 (快照)
  previousPlanId: text("previous_plan_id"), // 变更前的套餐ID
  previousStatus: text("previous_status"), // 变更前的状态
  
  // 变更后状态 (快照)
  newPlanId: text("new_plan_id"), // 变更后的套餐ID
  newStatus: text("new_status"), // 变更后的状态
  
  // 额外元数据
  metadata: jsonb("metadata"), 
  // 用于存储上下文信息，例如: { reason: "too_expensive", source: "stripe_webhook", proration_amount: 12.50 }
  
  // 时间戳
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), // 日志记录时间
})

// Drizzle 类型定义
export type SubscriptionLog = typeof subscriptionLogs.$inferSelect
export type NewSubscriptionLog = typeof subscriptionLogs.$inferInsert
