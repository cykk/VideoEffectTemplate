ALTER TABLE "transcription_jobs"
ADD COLUMN "raw_output_r2_key" text;

ALTER TABLE "transcription_jobs"
DROP COLUMN "full_text";

ALTER TABLE "transcription_jobs"
DROP COLUMN "raw_output_json";
