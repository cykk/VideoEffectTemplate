CREATE TABLE "transcription_translation_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"transcription_job_id" text NOT NULL,
	"target_language" text NOT NULL,
	"source_language" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"source_display_version" integer DEFAULT 1 NOT NULL,
	"provider" text DEFAULT 'aliyun' NOT NULL,
	"model" text DEFAULT 'general' NOT NULL,
	"error_message" text,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcription_translation_segments" (
	"id" text PRIMARY KEY NOT NULL,
	"translation_job_id" text NOT NULL,
	"source_segment_id" text NOT NULL,
	"order_index" integer NOT NULL,
	"text_translated" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transcription_translation_jobs" ADD CONSTRAINT "transcription_translation_jobs_transcription_job_id_transcription_jobs_id_fk" FOREIGN KEY ("transcription_job_id") REFERENCES "public"."transcription_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_translation_segments" ADD CONSTRAINT "transcription_translation_segments_translation_job_id_transcription_translation_jobs_id_fk" FOREIGN KEY ("translation_job_id") REFERENCES "public"."transcription_translation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_translation_segments" ADD CONSTRAINT "transcription_translation_segments_source_segment_id_transcription_display_segments_id_fk" FOREIGN KEY ("source_segment_id") REFERENCES "public"."transcription_display_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_translation_jobs_job_language_idx" ON "transcription_translation_jobs" USING btree ("transcription_job_id","target_language");--> statement-breakpoint
CREATE INDEX "transcription_translation_jobs_job_id_idx" ON "transcription_translation_jobs" USING btree ("transcription_job_id");--> statement-breakpoint
CREATE INDEX "transcription_translation_jobs_status_idx" ON "transcription_translation_jobs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_translation_segments_job_segment_idx" ON "transcription_translation_segments" USING btree ("translation_job_id","source_segment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_translation_segments_job_order_idx" ON "transcription_translation_segments" USING btree ("translation_job_id","order_index");--> statement-breakpoint
CREATE INDEX "transcription_translation_segments_job_id_idx" ON "transcription_translation_segments" USING btree ("translation_job_id");
