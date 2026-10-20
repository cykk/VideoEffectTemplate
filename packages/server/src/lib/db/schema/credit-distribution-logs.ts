/**
 * Credit Distribution Logs Schema
 * 
 * 用于审计和追踪每次积分发放执行的详细记录
 * 
 * 用途：
 * - 财务审计：完整记录每次发放执行
 * - 问题排查：追溯历史发放记录
 * - 合规要求：保留至少1年的记录
 * - 性能监控：分析执行时长和失败率
 */

import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

export const creditDistributionLogs = pgTable("credit_distribution_logs", {
  /** 唯一标识符 */
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),

  /** 执行时间（UTC） */
  executionDate: timestamp("execution_date", { withTimezone: true }).notNull(),

  /** 执行结果状态 */
  status: text("status", { 
    enum: ["success", "partial_failure", "total_failure"] 
  }).notNull(),

  /** 总订阅数 */
  totalSubscriptions: integer("total_subscriptions").notNull().default(0),

  /** 成功发放数 */
  processed: integer("processed").notNull().default(0),

  /** 跳过数 */
  skipped: integer("skipped").notNull().default(0),

  /** 失败数 */
  failed: integer("failed").notNull().default(0),

  /** 执行时长（毫秒） */
  duration: integer("duration").notNull(),

  /** 跳过原因统计 */
  skipReasons: jsonb("skip_reasons").$type<{
    already_granted: number;
    no_grant_history: number;
    expired: number;
    not_billing_day: number;
  }>(),

  /** 错误详情（前20个） */
  errors: jsonb("errors").$type<Array<{
    subscriptionId: string;
    userId: string;
    error: string;
  }>>(),

  /** Inngest 执行尝试次数 */
  attempt: integer("attempt").notNull().default(1),

  /** 额外元数据 */
  metadata: jsonb("metadata").$type<{
    task_run_id?: string;
    environment?: string;
    server_time_utc?: string;
    [key: string]: unknown;
  }>(),

  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type CreditDistributionLog = typeof creditDistributionLogs.$inferSelect;
export type NewCreditDistributionLog = typeof creditDistributionLogs.$inferInsert;

