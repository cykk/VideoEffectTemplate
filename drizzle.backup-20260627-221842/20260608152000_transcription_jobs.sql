CREATE TABLE "transcription_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"user_id" text,
	"anonymous_session_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"status_message" text,
	"source_type" text NOT NULL,
	"source_file_name" text NOT NULL,
	"source_content_type" text NOT NULL,
	"source_file_size" integer NOT NULL,
	"source_duration_ms" integer,
	"source_r2_key" text NOT NULL,
	"source_url" text NOT NULL,
	"derived_audio_r2_key" text,
	"derived_audio_url" text,
	"replicate_prediction_id" text,
	"replicate_version" text,
	"language" text,
	"speaker_count" integer,
	"duration_ms" integer,
	"full_text" text,
	"segments_json" json,
	"raw_output_json" json,
	"error_code" text,
	"error_message" text,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcription_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_jobs_public_id_idx" ON "transcription_jobs" USING btree ("public_id");
--> statement-breakpoint
CREATE INDEX "transcription_jobs_user_id_idx" ON "transcription_jobs" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "transcription_jobs_anon_session_id_idx" ON "transcription_jobs" USING btree ("anonymous_session_id");
--> statement-breakpoint
CREATE INDEX "transcription_jobs_prediction_id_idx" ON "transcription_jobs" USING btree ("replicate_prediction_id");
--> statement-breakpoint
CREATE INDEX "transcription_jobs_created_at_idx" ON "transcription_jobs" USING btree ("created_at");
