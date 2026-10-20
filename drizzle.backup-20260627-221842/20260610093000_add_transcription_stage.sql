ALTER TABLE "transcription_jobs"
ADD COLUMN "stage" text DEFAULT 'queued' NOT NULL;
