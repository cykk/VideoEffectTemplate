CREATE TABLE "transcription_feedback" (
  "id" text PRIMARY KEY NOT NULL,
  "transcription_job_id" text NOT NULL,
  "user_id" text,
  "anonymous_session_id" text,
  "rating" integer NOT NULL,
  "feedback_text" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "transcription_feedback_transcription_job_id_transcription_jobs_id_fk" FOREIGN KEY ("transcription_job_id") REFERENCES "public"."transcription_jobs"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "transcription_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX "transcription_feedback_job_id_idx" ON "transcription_feedback" USING btree ("transcription_job_id");
CREATE INDEX "transcription_feedback_user_id_idx" ON "transcription_feedback" USING btree ("user_id");
CREATE INDEX "transcription_feedback_anon_session_id_idx" ON "transcription_feedback" USING btree ("anonymous_session_id");
CREATE UNIQUE INDEX "transcription_feedback_job_user_idx" ON "transcription_feedback" USING btree ("transcription_job_id","user_id");
CREATE UNIQUE INDEX "transcription_feedback_job_anon_session_idx" ON "transcription_feedback" USING btree ("transcription_job_id","anonymous_session_id");
