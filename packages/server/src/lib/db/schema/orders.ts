import { pgTable, text, timestamp, integer, decimal, json } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * 订单表 (Orders)
 * 存储所有购买记录，包括订阅和一次性充值
 */
export const orders = pgTable("orders", {
  id: text("id").primaryKey().notNull(), // 订单ID
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // 关联用户ID
  
  // 订单基本信息
  orderNumber: text("order_number").notNull().unique(), // 业务订单号 (对外展示)
  status: text("status").notNull().default("pending"), // 状态: pending(待支付), paid(已支付), failed(失败), cancelled(取消), refunded(已退款)
  
  // 产品信息 (主要产品快照)
  productId: text("product_id").notNull(), // 产品ID (如: pro_monthly, credit_5000)
  productName: text("product_name").notNull(), // 产品名称
  productType: text("product_type").notNull(), // 类型: one_time(一次性购买), subscription(订阅)
  
  // 价格信息
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // 订单总金额
  currency: text("currency").notNull().default("USD"), // 货币代码
  
  // 支付信息
  paymentProvider: text("payment_provider").notNull(), // 支付提供商: creem, stripe 等
  paymentRequestId: text("payment_request_id"), // 第三方支付请求ID (如 checkout session id)
  paymentSessionId: text("payment_session_id"), // 支付会话ID
  
  // 客户信息 (从支付方回调或用户表获取)
  customerEmail: text("customer_email").notNull(), // 客户邮箱
  
  // 元数据
  metadata: json("metadata"), // 存储额外的订单信息 (JSON格式)
  
  // 时间戳
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(), // 创建时间
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(), // 更新时间
  paidAt: timestamp("paid_at", { withTimezone: true }), // 支付成功时间
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }), // 取消时间
});

/**
 * 订单项表 (Order Items)
 * 如果一个订单包含多个商品，在此存储详情 (当前业务主要是单商品，但也保留扩展性)
 */
export const orderItems = pgTable("order_items", {
  id: text("id").primaryKey().notNull(), // 记录ID
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }), // 关联订单ID
  
  // 商品信息
  productId: text("product_id").notNull(), // 商品ID
  productName: text("product_name").notNull(), // 商品名称
  productDescription: text("product_description"), // 商品描述
  
  // 价格信息
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(), // 单价
  quantity: integer("quantity").notNull().default(1), // 数量
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(), // 总价 (单价 * 数量)
  
  // 元数据
  metadata: json("metadata"),
  
  // 时间戳
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// 订单状态枚举
export type OrderStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";

// 产品类型枚举
export type ProductType = "one_time" | "subscription";

// 订单类型定义
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

// 订单项类型定义
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
