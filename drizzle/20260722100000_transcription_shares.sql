CREATE TABLE "transcription_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"transcription_job_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"share_token" text NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"allow_copy" boolean DEFAULT true NOT NULL,
	"allow_audio_playback" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"last_accessed_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transcription_shares" ADD CONSTRAINT "transcription_shares_transcription_job_id_transcription_jobs_id_fk" FOREIGN KEY ("transcription_job_id") REFERENCES "public"."transcription_jobs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transcription_shares" ADD CONSTRAINT "transcription_shares_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_shares_job_idx" ON "transcription_shares" USING btree ("transcription_job_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_shares_token_idx" ON "transcription_shares" USING btree ("share_token");
--> statement-breakpoint
CREATE INDEX "transcription_shares_owner_user_id_idx" ON "transcription_shares" USING btree ("owner_user_id");
