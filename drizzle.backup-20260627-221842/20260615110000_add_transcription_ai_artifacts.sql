ALTER TABLE "transcription_jobs"
ADD COLUMN "summary_template_key" text DEFAULT 'off' NOT NULL;

CREATE TABLE "transcription_ai_artifacts" (
  "id" text PRIMARY KEY NOT NULL,
  "transcription_job_id" text NOT NULL REFERENCES "transcription_jobs"("id") ON DELETE cascade,
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

CREATE UNIQUE INDEX "transcription_ai_artifacts_job_template_idx"
ON "transcription_ai_artifacts" ("transcription_job_id", "template_key");

CREATE INDEX "transcription_ai_artifacts_job_id_idx"
ON "transcription_ai_artifacts" ("transcription_job_id");

CREATE INDEX "transcription_ai_artifacts_status_idx"
ON "transcription_ai_artifacts" ("status");
