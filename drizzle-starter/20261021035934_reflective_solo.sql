CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text,
	"image" text,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_link" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "magic_link_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"product_description" text,
	"unit_price" numeric(10, 2) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"order_number" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"product_type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"payment_provider" text NOT NULL,
	"payment_request_id" text,
	"payment_session_id" text,
	"customer_email" text NOT NULL,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"source" text,
	"order_id" text,
	"subscription_id" text,
	"idempotency_key" text,
	"expires_at" timestamp with time zone,
	"description" text,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_transactions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "user_credits" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subscription_credits" integer DEFAULT 0 NOT NULL,
	"purchased_credits" integer DEFAULT 0 NOT NULL,
	"bonus_credits" integer DEFAULT 0 NOT NULL,
	"total_balance" integer DEFAULT 0 NOT NULL,
	"total_earned" integer DEFAULT 0 NOT NULL,
	"total_spent" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_credits_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"plan_name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"provider" text NOT NULL,
	"provider_subscription_id" text NOT NULL,
	"provider_customer_id" text,
	"interval" text NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"credits_per_period" integer NOT NULL,
	"last_credit_grant_at" timestamp with time zone,
	"credit_grant_count" integer DEFAULT 0 NOT NULL,
	"cancel_at" timestamp with time zone,
	"cancel_at_period_end" integer DEFAULT 0 NOT NULL,
	"cancelled_at" timestamp with time zone,
	"scheduled_plan_id" text,
	"scheduled_plan_name" text,
	"scheduled_credits_per_period" integer,
	"scheduled_interval" text,
	"scheduled_change_at" timestamp with time zone,
	"scheduled_change_type" text,
	"cycle_change_count" integer DEFAULT 0 NOT NULL,
	"last_plan_change_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"previous_plan_id" text,
	"previous_status" text,
	"new_plan_id" text,
	"new_status" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_distribution_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"execution_date" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"total_subscriptions" integer DEFAULT 0 NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"duration" integer NOT NULL,
	"skip_reasons" jsonb,
	"errors" jsonb,
	"attempt" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"anonymous_id" text,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redemption_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"batch_id" text NOT NULL,
	"provider" text DEFAULT 'appsumo' NOT NULL,
	"tier_id" text DEFAULT 'appsumo_tier1' NOT NULL,
	"credits_amount" integer DEFAULT 3000 NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"redeemed_by" text,
	"redeemed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redemption_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "redemption_records" (
	"id" text PRIMARY KEY NOT NULL,
	"code_id" text NOT NULL,
	"user_id" text NOT NULL,
	"provider" text DEFAULT 'appsumo' NOT NULL,
	"tier_id" text NOT NULL,
	"credits_granted" integer NOT NULL,
	"credit_transaction_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waffo_events" (
	"id" text PRIMARY KEY NOT NULL,
	"mode" text NOT NULL,
	"store_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "waffo_orders" (
	"order_id" text PRIMARY KEY NOT NULL,
	"mode" text NOT NULL,
	"store_id" text NOT NULL,
	"remote_order_id" text,
	"session_id" text,
	"expires_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"subscription_id" text,
	"last_event_at" timestamp with time zone,
	"last_reconciled_at" timestamp with time zone,
	"review_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waffo_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"mode" text NOT NULL,
	"store_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"remote_order_id" text NOT NULL,
	"currency" text NOT NULL,
	"subtotal" numeric(18, 4),
	"tax" numeric(18, 4),
	"total" numeric(18, 4),
	"charged" numeric(18, 4),
	"period_number" integer,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waffo_refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"mode" text NOT NULL,
	"store_id" text NOT NULL,
	"refund_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"amount" numeric(18, 4) NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"credit_status" text DEFAULT 'review' NOT NULL,
	"review_note" text,
	"reviewed_by" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"request_key" text NOT NULL,
	"feature_key" text NOT NULL,
	"model_version" text NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"prediction_id" text,
	"credits" integer NOT NULL,
	"credit_breakdown" jsonb NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"error_code" text,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credits" ADD CONSTRAINT "user_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_logs" ADD CONSTRAINT "subscription_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption_codes" ADD CONSTRAINT "redemption_codes_redeemed_by_users_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption_records" ADD CONSTRAINT "redemption_records_code_id_redemption_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."redemption_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption_records" ADD CONSTRAINT "redemption_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waffo_orders" ADD CONSTRAINT "waffo_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waffo_payments" ADD CONSTRAINT "waffo_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waffo_refunds" ADD CONSTRAINT "waffo_refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_messages_created_at_idx" ON "contact_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contact_messages_status_idx" ON "contact_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contact_messages_user_id_idx" ON "contact_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "redemption_codes_status_idx" ON "redemption_codes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "redemption_codes_redeemed_by_idx" ON "redemption_codes" USING btree ("redeemed_by");--> statement-breakpoint
CREATE INDEX "redemption_records_user_id_idx" ON "redemption_records" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "redemption_records_code_id_idx" ON "redemption_records" USING btree ("code_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waffo_events_identity" ON "waffo_events" USING btree ("mode","store_id","event_type","event_id");--> statement-breakpoint
CREATE INDEX "waffo_events_pending" ON "waffo_events" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "waffo_orders_remote" ON "waffo_orders" USING btree ("mode","store_id","remote_order_id");--> statement-breakpoint
CREATE INDEX "waffo_orders_reconcile" ON "waffo_orders" USING btree ("mode","store_id","last_reconciled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "waffo_orders_subscription" ON "waffo_orders" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waffo_payments_identity" ON "waffo_payments" USING btree ("mode","store_id","payment_id");--> statement-breakpoint
CREATE INDEX "waffo_payments_order" ON "waffo_payments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waffo_refunds_identity" ON "waffo_refunds" USING btree ("mode","store_id","refund_id");--> statement-breakpoint
CREATE INDEX "waffo_refunds_order" ON "waffo_refunds" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_jobs_user_request" ON "ai_jobs" USING btree ("user_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_jobs_prediction" ON "ai_jobs" USING btree ("prediction_id");--> statement-breakpoint
CREATE INDEX "ai_jobs_user_created" ON "ai_jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_jobs_pending" ON "ai_jobs" USING btree ("status","updated_at");