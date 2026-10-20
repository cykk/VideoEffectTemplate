import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

// Better Auth 核心表结构 - 使用现有的users表
export const user = users;

/**
 * 会话表 (Session)
 * 存储用户的登录会话信息
 */
export const session = pgTable("session", {
  id: text("id").primaryKey().notNull(), // 会话ID
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), // 关联的用户ID
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // 会话过期时间
  token: text("token").notNull().unique(), // 会话Token
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), // 创建时间
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), // 更新时间
  ipAddress: text("ip_address"), // 登录IP地址
  userAgent: text("user_agent"), // 用户代理信息（浏览器/设备）
});

/**
 * 账户表 (Account)
 * 存储用户的第三方登录账户信息（如 Google, GitHub）或密码登录信息
 */
export const account = pgTable("account", {
  id: text("id").primaryKey().notNull(), // 账户记录ID
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), // 关联的用户ID
  accountId: text("account_id").notNull(), // 第三方平台的用户ID
  providerId: text("provider_id").notNull(), // 提供商ID (如: "google", "github", "credential")
  accessToken: text("access_token"), // OAuth 访问令牌
  refreshToken: text("refresh_token"), // OAuth 刷新令牌
  idToken: text("id_token"), // OAuth ID令牌
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }), // 访问令牌过期时间
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }), // 刷新令牌过期时间
  scope: text("scope"), // OAuth 权限范围
  password: text("password"), // 密码（如果使用密码登录）
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), // 创建时间
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), // 更新时间
});

/**
 * 验证表 (Verification)
 * 用于存储验证码、验证Token等临时验证信息
 */
export const verification = pgTable("verification", {
  id: text("id").primaryKey().notNull(), // 验证记录ID
  identifier: text("identifier").notNull(), // 标识符（如邮箱、手机号）
  value: text("value").notNull(), // 验证值（验证码或Token）
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // 过期时间
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), // 创建时间
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), // 更新时间
});

/**
 * 魔术链接表 (Magic Link)
 * 用于无密码登录的魔术链接插件
 */
export const magicLink = pgTable("magic_link", {
  id: text("id").primaryKey().notNull(), // 记录ID
  email: text("email").notNull(), // 目标邮箱
  token: text("token").notNull().unique(), // 链接Token
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // 过期时间
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), // 创建时间
});
