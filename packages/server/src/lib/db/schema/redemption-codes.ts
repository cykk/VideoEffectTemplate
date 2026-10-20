import { pgTable, text, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { users } from "./users";

export const redemptionCodes = pgTable(
  "redemption_codes",
  {
    id: text("id")
      .primaryKey()
      .notNull()
      .$defaultFn(() => nanoid()),
    code: text("code").notNull().unique(),
    batchId: text("batch_id").notNull(),
    provider: text("provider").notNull().default("appsumo"),
    tierId: text("tier_id").notNull().default("appsumo_tier1"),
    creditsAmount: integer("credits_amount").notNull().default(3000),
    status: text("status").notNull().default("available"),
    redeemedBy: text("redeemed_by").references(() => users.id),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokeReason: text("revoke_reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("redemption_codes_status_idx").on(table.status),
    redeemedByIdx: index("redemption_codes_redeemed_by_idx").on(table.redeemedBy),
  })
);

export const redemptionRecords = pgTable(
  "redemption_records",
  {
    id: text("id")
      .primaryKey()
      .notNull()
      .$defaultFn(() => nanoid()),
    codeId: text("code_id")
      .notNull()
      .references(() => redemptionCodes.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("appsumo"),
    tierId: text("tier_id").notNull(),
    creditsGranted: integer("credits_granted").notNull(),
    creditTransactionId: text("credit_transaction_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("redemption_records_user_id_idx").on(table.userId),
    codeUniqueIdx: uniqueIndex("redemption_records_code_id_idx").on(table.codeId),
  })
);

export type RedemptionCode = typeof redemptionCodes.$inferSelect;
export type NewRedemptionCode = typeof redemptionCodes.$inferInsert;
export type RedemptionRecord = typeof redemptionRecords.$inferSelect;
export type NewRedemptionRecord = typeof redemptionRecords.$inferInsert;
