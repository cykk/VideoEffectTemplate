CREATE TABLE "transcription_failure_archives" (
	"id" text PRIMARY KEY NOT NULL,
	"transcription_job_id" text,
	"public_id" text NOT NULL,
	"user_id" text,
	"owner_type" text NOT NULL,
	"source_r2_key" text,
	"derived_audio_r2_key" text,
	"raw_output_r2_key" text,
	"source_file_name" text NOT NULL,
	"source_content_type" text NOT NULL,
	"source_file_size" integer NOT NULL,
	"source_duration_ms" integer,
	"processed_duration_ms" integer,
	"failure_stage" text NOT NULL,
	"error_code" text NOT NULL,
	"error_message" text NOT NULL,
	"replicate_prediction_id" text,
	"replicate_version" text,
	"media_retention_mode" text DEFAULT 'metadata_only' NOT NULL,
	"media_retain_until" timestamp with time zone,
	"metadata_retain_until" timestamp with time zone NOT NULL,
	"media_deleted_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "transcription_failure_archives" ADD CONSTRAINT "transcription_failure_archives_transcription_job_id_transcription_jobs_id_fk" FOREIGN KEY ("transcription_job_id") REFERENCES "public"."transcription_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_failure_archives" ADD CONSTRAINT "transcription_failure_archives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_failure_archives_public_id_idx" ON "transcription_failure_archives" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "transcription_failure_archives_failure_lookup_idx" ON "transcription_failure_archives" USING btree ("failure_stage","error_code","created_at");--> statement-breakpoint
CREATE INDEX "transcription_failure_archives_media_retention_idx" ON "transcription_failure_archives" USING btree ("media_retain_until");--> statement-breakpoint
CREATE INDEX "transcription_failure_archives_metadata_retention_idx" ON "transcription_failure_archives" USING btree ("metadata_retain_until");
