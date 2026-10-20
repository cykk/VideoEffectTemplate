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
ALTER TABLE "redemption_codes" ADD CONSTRAINT "redemption_codes_redeemed_by_users_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "redemption_records" ADD CONSTRAINT "redemption_records_code_id_redemption_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."redemption_codes"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "redemption_records" ADD CONSTRAINT "redemption_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "redemption_codes_status_idx" ON "redemption_codes" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "redemption_codes_redeemed_by_idx" ON "redemption_codes" USING btree ("redeemed_by");
--> statement-breakpoint
CREATE INDEX "redemption_records_user_id_idx" ON "redemption_records" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "redemption_records_code_id_idx" ON "redemption_records" USING btree ("code_id");
