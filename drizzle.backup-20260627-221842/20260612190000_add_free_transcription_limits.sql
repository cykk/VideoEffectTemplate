ALTER TABLE "transcription_jobs"
ADD COLUMN "duration_limit_ms" integer,
ADD COLUMN "processed_duration_ms" integer,
ADD COLUMN "was_duration_trimmed" boolean DEFAULT false NOT NULL;
