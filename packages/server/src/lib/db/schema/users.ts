import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

/**
 * 用户表 (Users)
 * 系统的核心用户表，存储基础身份信息
 */
export const users = pgTable("users", {
  id: text("id").primaryKey().notNull(), // 用户ID (UUID或CUID)
  email: text("email").notNull().unique(), // 邮箱地址 (唯一标识)
  displayName: text("display_name"), // 显示名称 (昵称)
  emailVerified: boolean("email_verified").notNull().default(false), // 邮箱是否已验证
  name: text("name"), // 全名
  image: text("image"), // 头像URL
  role: text("role").default("user").notNull(), // 'user' | 'admin' - 角色控制
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(), // 注册时间
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(), // 资料更新时间
});
