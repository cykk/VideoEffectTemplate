import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users'

export const aiJobs = pgTable('ai_jobs', {
  id: text('id').primaryKey().notNull(),
  userId: text('user_id').notNull().references(() => users.id),
  requestKey: text('request_key').notNull(),
  featureKey: text('feature_key').notNull(),
  modelVersion: text('model_version').notNull(),
  status: text('status').notNull().default('reserved'),
  predictionId: text('prediction_id'),
  credits: integer('credits').notNull(),
  creditBreakdown: jsonb('credit_breakdown').$type<{ subscription: number; bonus: number; purchased: number }>().notNull(),
  input: jsonb('input').$type<Record<string, unknown>>().notNull(),
  output: jsonb('output'),
  errorCode: text('error_code'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex('ai_jobs_user_request').on(table.userId, table.requestKey),
  uniqueIndex('ai_jobs_prediction').on(table.predictionId),
  index('ai_jobs_user_created').on(table.userId, table.createdAt),
  index('ai_jobs_pending').on(table.status, table.updatedAt),
])
