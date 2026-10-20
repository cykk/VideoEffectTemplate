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
ALTER TABLE "waffo_orders" ADD CONSTRAINT "waffo_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "waffo_payments" ADD CONSTRAINT "waffo_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "waffo_refunds" ADD CONSTRAINT "waffo_refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "waffo_events_identity" ON "waffo_events" USING btree ("mode","store_id","event_type","event_id");
--> statement-breakpoint
CREATE INDEX "waffo_events_pending" ON "waffo_events" USING btree ("status","next_attempt_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "waffo_orders_remote" ON "waffo_orders" USING btree ("mode","store_id","remote_order_id");
--> statement-breakpoint
CREATE INDEX "waffo_orders_reconcile" ON "waffo_orders" USING btree ("mode","store_id","last_reconciled_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "waffo_orders_subscription" ON "waffo_orders" USING btree ("subscription_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "waffo_payments_identity" ON "waffo_payments" USING btree ("mode","store_id","payment_id");
--> statement-breakpoint
CREATE INDEX "waffo_payments_order" ON "waffo_payments" USING btree ("order_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "waffo_refunds_identity" ON "waffo_refunds" USING btree ("mode","store_id","refund_id");
--> statement-breakpoint
CREATE INDEX "waffo_refunds_order" ON "waffo_refunds" USING btree ("order_id");
