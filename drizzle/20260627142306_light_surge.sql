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
CREATE TABLE "transcription_ai_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"transcription_job_id" text NOT NULL,
	"template_key" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"source_display_version" integer DEFAULT 1 NOT NULL,
	"summary_json" json,
	"mind_map_json" json,
	"provider" text DEFAULT 'openai' NOT NULL,
	"model" text NOT NULL,
	"error_message" text,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcription_display_segments" (
	"id" text PRIMARY KEY NOT NULL,
	"transcription_job_id" text NOT NULL,
	"speaker_id" text NOT NULL,
	"order_index" integer NOT NULL,
	"source_start_index" integer NOT NULL,
	"source_end_index" integer NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"text_original" text NOT NULL,
	"text_current" text NOT NULL,
	"is_edited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcription_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"transcription_job_id" text NOT NULL,
	"user_id" text,
	"anonymous_session_id" text,
	"rating" integer NOT NULL,
	"feedback_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcription_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"user_id" text,
	"anonymous_session_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text DEFAULT 'queued' NOT NULL,
	"status_message" text,
	"source_type" text NOT NULL,
	"source_file_name" text NOT NULL,
	"source_content_type" text NOT NULL,
	"source_file_size" integer NOT NULL,
	"source_duration_ms" integer,
	"duration_limit_ms" integer,
	"processed_duration_ms" integer,
	"was_duration_trimmed" boolean DEFAULT false NOT NULL,
	"summary_template_key" text DEFAULT 'off' NOT NULL,
	"mind_map_template_key" text DEFAULT 'off' NOT NULL,
	"source_r2_key" text NOT NULL,
	"source_url" text NOT NULL,
	"derived_audio_r2_key" text,
	"derived_audio_url" text,
	"replicate_prediction_id" text,
	"replicate_version" text,
	"language" text,
	"speaker_count" integer,
	"duration_ms" integer,
	"display_full_text" text,
	"display_version" integer DEFAULT 1 NOT NULL,
	"has_user_edits" boolean DEFAULT false NOT NULL,
	"segments_json" json,
	"raw_output_r2_key" text,
	"error_code" text,
	"error_message" text,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcription_speakers" (
	"id" text PRIMARY KEY NOT NULL,
	"transcription_job_id" text NOT NULL,
	"speaker_key" text NOT NULL,
	"default_label" text NOT NULL,
	"display_name" text,
	"color_token" text NOT NULL,
	"order_index" integer NOT NULL,
	"is_unknown" boolean DEFAULT false NOT NULL,
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
ALTER TABLE "transcription_ai_artifacts" ADD CONSTRAINT "transcription_ai_artifacts_transcription_job_id_transcription_jobs_id_fk" FOREIGN KEY ("transcription_job_id") REFERENCES "public"."transcription_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_display_segments" ADD CONSTRAINT "transcription_display_segments_transcription_job_id_transcription_jobs_id_fk" FOREIGN KEY ("transcription_job_id") REFERENCES "public"."transcription_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_display_segments" ADD CONSTRAINT "transcription_display_segments_speaker_id_transcription_speakers_id_fk" FOREIGN KEY ("speaker_id") REFERENCES "public"."transcription_speakers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_feedback" ADD CONSTRAINT "transcription_feedback_transcription_job_id_transcription_jobs_id_fk" FOREIGN KEY ("transcription_job_id") REFERENCES "public"."transcription_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_feedback" ADD CONSTRAINT "transcription_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_speakers" ADD CONSTRAINT "transcription_speakers_transcription_job_id_transcription_jobs_id_fk" FOREIGN KEY ("transcription_job_id") REFERENCES "public"."transcription_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_messages_created_at_idx" ON "contact_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contact_messages_status_idx" ON "contact_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contact_messages_user_id_idx" ON "contact_messages" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_ai_artifacts_job_template_idx" ON "transcription_ai_artifacts" USING btree ("transcription_job_id","template_key");--> statement-breakpoint
CREATE INDEX "transcription_ai_artifacts_job_id_idx" ON "transcription_ai_artifacts" USING btree ("transcription_job_id");--> statement-breakpoint
CREATE INDEX "transcription_ai_artifacts_status_idx" ON "transcription_ai_artifacts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_display_segments_job_order_idx" ON "transcription_display_segments" USING btree ("transcription_job_id","order_index");--> statement-breakpoint
CREATE INDEX "transcription_display_segments_job_id_idx" ON "transcription_display_segments" USING btree ("transcription_job_id");--> statement-breakpoint
CREATE INDEX "transcription_display_segments_speaker_id_idx" ON "transcription_display_segments" USING btree ("speaker_id");--> statement-breakpoint
CREATE INDEX "transcription_feedback_job_id_idx" ON "transcription_feedback" USING btree ("transcription_job_id");--> statement-breakpoint
CREATE INDEX "transcription_feedback_user_id_idx" ON "transcription_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transcription_feedback_anon_session_id_idx" ON "transcription_feedback" USING btree ("anonymous_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_feedback_job_user_idx" ON "transcription_feedback" USING btree ("transcription_job_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_feedback_job_anon_session_idx" ON "transcription_feedback" USING btree ("transcription_job_id","anonymous_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_jobs_public_id_idx" ON "transcription_jobs" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "transcription_jobs_user_id_idx" ON "transcription_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transcription_jobs_anon_session_id_idx" ON "transcription_jobs" USING btree ("anonymous_session_id");--> statement-breakpoint
CREATE INDEX "transcription_jobs_prediction_id_idx" ON "transcription_jobs" USING btree ("replicate_prediction_id");--> statement-breakpoint
CREATE INDEX "transcription_jobs_created_at_idx" ON "transcription_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_speakers_job_key_idx" ON "transcription_speakers" USING btree ("transcription_job_id","speaker_key");--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_speakers_job_order_idx" ON "transcription_speakers" USING btree ("transcription_job_id","order_index");--> statement-breakpoint
CREATE INDEX "transcription_speakers_job_id_idx" ON "transcription_speakers" USING btree ("transcription_job_id");