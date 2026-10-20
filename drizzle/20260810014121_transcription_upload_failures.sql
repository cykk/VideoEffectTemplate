CREATE TABLE "transcription_upload_failures" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text,
	"user_id" text,
	"anonymous_session_id" text,
	"source_type" text,
	"file_name" text,
	"content_type" text,
	"file_size" integer,
	"failure_stage" text NOT NULL,
	"error_code" text NOT NULL,
	"error_message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transcription_upload_failures" ADD CONSTRAINT "transcription_upload_failures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "transcription_upload_failures_created_at_idx" ON "transcription_upload_failures" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "transcription_upload_failures_failure_stage_idx" ON "transcription_upload_failures" USING btree ("failure_stage");
--> statement-breakpoint
CREATE INDEX "transcription_upload_failures_error_code_idx" ON "transcription_upload_failures" USING btree ("error_code");
--> statement-breakpoint
CREATE INDEX "transcription_upload_failures_user_id_idx" ON "transcription_upload_failures" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "transcription_upload_failures_anon_session_idx" ON "transcription_upload_failures" USING btree ("anonymous_session_id");
