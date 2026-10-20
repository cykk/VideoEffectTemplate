DROP INDEX "transcription_failure_archives_media_retention_idx";--> statement-breakpoint
ALTER TABLE "transcription_failure_archives" DROP COLUMN "source_r2_key";--> statement-breakpoint
ALTER TABLE "transcription_failure_archives" DROP COLUMN "derived_audio_r2_key";--> statement-breakpoint
ALTER TABLE "transcription_failure_archives" DROP COLUMN "raw_output_r2_key";--> statement-breakpoint
ALTER TABLE "transcription_failure_archives" DROP COLUMN "media_retention_mode";--> statement-breakpoint
ALTER TABLE "transcription_failure_archives" DROP COLUMN "media_retain_until";--> statement-breakpoint
ALTER TABLE "transcription_failure_archives" DROP COLUMN "media_deleted_at";--> statement-breakpoint
UPDATE "transcription_failure_archives"
SET "metadata_retain_until" = "created_at" + INTERVAL '180 days';
