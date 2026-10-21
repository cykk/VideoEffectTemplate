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
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_jobs_user_request" ON "ai_jobs" USING btree ("user_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_jobs_prediction" ON "ai_jobs" USING btree ("prediction_id");--> statement-breakpoint
CREATE INDEX "ai_jobs_user_created" ON "ai_jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_jobs_pending" ON "ai_jobs" USING btree ("status","updated_at");