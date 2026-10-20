ALTER TABLE "transcription_jobs"
ADD COLUMN "display_full_text" text,
ADD COLUMN "display_version" integer DEFAULT 1 NOT NULL,
ADD COLUMN "has_user_edits" boolean DEFAULT false NOT NULL;
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcription_speakers_transcription_job_id_transcription_jobs_id_fk" FOREIGN KEY ("transcription_job_id") REFERENCES "public"."transcription_jobs"("id") ON DELETE cascade ON UPDATE no action
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcription_display_segments_transcription_job_id_transcription_jobs_id_fk" FOREIGN KEY ("transcription_job_id") REFERENCES "public"."transcription_jobs"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "transcription_display_segments_speaker_id_transcription_speakers_id_fk" FOREIGN KEY ("speaker_id") REFERENCES "public"."transcription_speakers"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_speakers_job_key_idx" ON "transcription_speakers" USING btree ("transcription_job_id","speaker_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_speakers_job_order_idx" ON "transcription_speakers" USING btree ("transcription_job_id","order_index");
--> statement-breakpoint
CREATE INDEX "transcription_speakers_job_id_idx" ON "transcription_speakers" USING btree ("transcription_job_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_display_segments_job_order_idx" ON "transcription_display_segments" USING btree ("transcription_job_id","order_index");
--> statement-breakpoint
CREATE INDEX "transcription_display_segments_job_id_idx" ON "transcription_display_segments" USING btree ("transcription_job_id");
--> statement-breakpoint
CREATE INDEX "transcription_display_segments_speaker_id_idx" ON "transcription_display_segments" USING btree ("speaker_id");
