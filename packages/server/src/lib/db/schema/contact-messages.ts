import { nanoid } from "nanoid";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: text("id").primaryKey().notNull().$defaultFn(() => nanoid()),
    userId: text("user_id"),
    anonymousId: text("anonymous_id"),
    email: text("email").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("new"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("contact_messages_created_at_idx").on(table.createdAt),
    index("contact_messages_status_idx").on(table.status),
    index("contact_messages_user_id_idx").on(table.userId),
  ],
);

export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewContactMessage = typeof contactMessages.$inferInsert;
