import {
  boolean,
  index,
  integer,
  json,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { users } from "./users";
import type {
  TranscriptionAiSummaryData,
  TranscriptionMindMapData,
} from "@markless/shared/src/types/transcriptions";

export const transcriptionJobs = pgTable(
  "transcription_jobs",
  {
    id: text("id").primaryKey().notNull().$defaultFn(() => nanoid()),
    publicId: text("public_id").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    anonymousSessionId: text("anonymous_session_id"),
    status: text("status").notNull().default("queued"),
    stage: text("stage").notNull().default("queued"),
    statusMessage: text("status_message"),
    sourceType: text("source_type").notNull(),
    sourceFileName: text("source_file_name").notNull(),
    sourceDisplayTitle: text("source_display_title"),
    sourceContentType: text("source_content_type").notNull(),
    sourceFileSize: integer("source_file_size").notNull(),
    sourceDurationMs: integer("source_duration_ms"),
    durationLimitMs: integer("duration_limit_ms"),
    processedDurationMs: integer("processed_duration_ms"),
    wasDurationTrimmed: boolean("was_duration_trimmed").notNull().default(false),
    summaryTemplateKey: text("summary_template_key").notNull().default("off"),
    mindMapTemplateKey: text("mind_map_template_key").notNull().default("off"),
    transcriptSource: text("transcript_source").notNull().default("ai_transcription"),
    sourceR2Key: text("source_r2_key").notNull(),
    sourceUrl: text("source_url").notNull(),
    derivedAudioR2Key: text("derived_audio_r2_key"),
    derivedAudioUrl: text("derived_audio_url"),
    replicatePredictionId: text("replicate_prediction_id"),
    replicateVersion: text("replicate_version"),
    requestedLanguage: text("requested_language"),
    language: text("language"),
    speakerCount: integer("speaker_count"),
    durationMs: integer("duration_ms"),
    displayFullText: text("display_full_text"),
    displayVersion: integer("display_version").notNull().default(1),
    hasUserEdits: boolean("has_user_edits").notNull().default(false),
    segmentsJson: json("segments_json"),
    rawOutputR2Key: text("raw_output_r2_key"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    publicIdUnique: uniqueIndex("transcription_jobs_public_id_idx").on(table.publicId),
    userIdIdx: index("transcription_jobs_user_id_idx").on(table.userId),
    anonymousSessionIdIdx: index("transcription_jobs_anon_session_id_idx").on(
      table.anonymousSessionId
    ),
    replicatePredictionIdIdx: index("transcription_jobs_prediction_id_idx").on(
      table.replicatePredictionId
    ),
    createdAtIdx: index("transcription_jobs_created_at_idx").on(table.createdAt),
  })
);

export const transcriptionSpeakers = pgTable(
  "transcription_speakers",
  {
    id: text("id").primaryKey().notNull().$defaultFn(() => nanoid()),
    transcriptionJobId: text("transcription_job_id")
      .notNull()
      .references(() => transcriptionJobs.id, { onDelete: "cascade" }),
    speakerKey: text("speaker_key").notNull(),
    defaultLabel: text("default_label").notNull(),
    displayName: text("display_name"),
    colorToken: text("color_token").notNull(),
    orderIndex: integer("order_index").notNull(),
    isUnknown: boolean("is_unknown").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    jobSpeakerKeyUnique: uniqueIndex("transcription_speakers_job_key_idx").on(
      table.transcriptionJobId,
      table.speakerKey
    ),
    jobOrderUnique: uniqueIndex("transcription_speakers_job_order_idx").on(
      table.transcriptionJobId,
      table.orderIndex
    ),
    jobIdx: index("transcription_speakers_job_id_idx").on(table.transcriptionJobId),
  })
);

export const transcriptionDisplaySegments = pgTable(
  "transcription_display_segments",
  {
    id: text("id").primaryKey().notNull().$defaultFn(() => nanoid()),
    transcriptionJobId: text("transcription_job_id")
      .notNull()
      .references(() => transcriptionJobs.id, { onDelete: "cascade" }),
    speakerId: text("speaker_id")
      .notNull()
      .references(() => transcriptionSpeakers.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    sourceStartIndex: integer("source_start_index").notNull(),
    sourceEndIndex: integer("source_end_index").notNull(),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    textOriginal: text("text_original").notNull(),
    textCurrent: text("text_current").notNull(),
    speakerLabelOverride: text("speaker_label_override"),
    isEdited: boolean("is_edited").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    jobOrderUnique: uniqueIndex("transcription_display_segments_job_order_idx").on(
      table.transcriptionJobId,
      table.orderIndex
    ),
    jobIdx: index("transcription_display_segments_job_id_idx").on(table.transcriptionJobId),
    speakerIdx: index("transcription_display_segments_speaker_id_idx").on(table.speakerId),
  })
);

export const transcriptionFeedback = pgTable(
  "transcription_feedback",
  {
    id: text("id").primaryKey().notNull().$defaultFn(() => nanoid()),
    transcriptionJobId: text("transcription_job_id")
      .notNull()
      .references(() => transcriptionJobs.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    anonymousSessionId: text("anonymous_session_id"),
    rating: integer("rating").notNull(),
    feedbackText: text("feedback_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    jobIdx: index("transcription_feedback_job_id_idx").on(table.transcriptionJobId),
    userIdx: index("transcription_feedback_user_id_idx").on(table.userId),
    anonymousSessionIdx: index("transcription_feedback_anon_session_id_idx").on(
      table.anonymousSessionId
    ),
    jobUserUnique: uniqueIndex("transcription_feedback_job_user_idx").on(
      table.transcriptionJobId,
      table.userId
    ),
    jobAnonymousSessionUnique: uniqueIndex(
      "transcription_feedback_job_anon_session_idx"
    ).on(table.transcriptionJobId, table.anonymousSessionId),
  })
);

export const transcriptionAiArtifacts = pgTable(
  "transcription_ai_artifacts",
  {
    id: text("id").primaryKey().notNull().$defaultFn(() => nanoid()),
    transcriptionJobId: text("transcription_job_id")
      .notNull()
      .references(() => transcriptionJobs.id, { onDelete: "cascade" }),
    templateKey: text("template_key").notNull(),
    status: text("status").notNull().default("processing"),
    sourceDisplayVersion: integer("source_display_version").notNull().default(1),
    summaryJson: json("summary_json").$type<TranscriptionAiSummaryData | null>(),
    mindMapJson: json("mind_map_json").$type<TranscriptionMindMapData | null>(),
    provider: text("provider").notNull().default("openai"),
    model: text("model").notNull(),
    errorMessage: text("error_message"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    jobTemplateUnique: uniqueIndex("transcription_ai_artifacts_job_template_idx").on(
      table.transcriptionJobId,
      table.templateKey
    ),
    jobIdx: index("transcription_ai_artifacts_job_id_idx").on(table.transcriptionJobId),
    statusIdx: index("transcription_ai_artifacts_status_idx").on(table.status),
  })
);

export const transcriptionTranslationJobs = pgTable(
  "transcription_translation_jobs",
  {
    id: text("id").primaryKey().notNull().$defaultFn(() => nanoid()),
    transcriptionJobId: text("transcription_job_id")
      .notNull()
      .references(() => transcriptionJobs.id, { onDelete: "cascade" }),
    targetLanguage: text("target_language").notNull(),
    sourceLanguage: text("source_language"),
    status: text("status").notNull().default("queued"),
    sourceDisplayVersion: integer("source_display_version").notNull().default(1),
    provider: text("provider").notNull().default("aliyun"),
    model: text("model").notNull().default("general"),
    errorMessage: text("error_message"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    jobLanguageUnique: uniqueIndex("transcription_translation_jobs_job_language_idx").on(
      table.transcriptionJobId,
      table.targetLanguage
    ),
    jobIdx: index("transcription_translation_jobs_job_id_idx").on(table.transcriptionJobId),
    statusIdx: index("transcription_translation_jobs_status_idx").on(table.status),
  })
);

export const transcriptionTranslationSegments = pgTable(
  "transcription_translation_segments",
  {
    id: text("id").primaryKey().notNull().$defaultFn(() => nanoid()),
    translationJobId: text("translation_job_id")
      .notNull()
      .references(() => transcriptionTranslationJobs.id, { onDelete: "cascade" }),
    sourceSegmentId: text("source_segment_id")
      .notNull()
      .references(() => transcriptionDisplaySegments.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    textTranslated: text("text_translated").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    jobSegmentUnique: uniqueIndex(
      "transcription_translation_segments_job_segment_idx"
    ).on(table.translationJobId, table.sourceSegmentId),
    jobOrderUnique: uniqueIndex("transcription_translation_segments_job_order_idx").on(
      table.translationJobId,
      table.orderIndex
    ),
    jobIdx: index("transcription_translation_segments_job_id_idx").on(table.translationJobId),
  })
);

export const transcriptionShares = pgTable(
  "transcription_shares",
  {
    id: text("id").primaryKey().notNull().$defaultFn(() => nanoid()),
    transcriptionJobId: text("transcription_job_id")
      .notNull()
      .references(() => transcriptionJobs.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    visibility: text("visibility").notNull().default("private"),
    shareToken: text("share_token").notNull(),
    isRevoked: boolean("is_revoked").notNull().default(false),
    allowCopy: boolean("allow_copy").notNull().default(true),
    allowAudioPlayback: boolean("allow_audio_playback").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    jobUnique: uniqueIndex("transcription_shares_job_idx").on(table.transcriptionJobId),
    shareTokenUnique: uniqueIndex("transcription_shares_token_idx").on(table.shareToken),
    ownerIdx: index("transcription_shares_owner_user_id_idx").on(table.ownerUserId),
  })
);

/** Internal diagnostics for terminal transcription failures. */
export const transcriptionFailureArchives = pgTable(
  "transcription_failure_archives",
  {
    id: text("id").primaryKey().notNull().$defaultFn(() => nanoid()),
    transcriptionJobId: text("transcription_job_id").references(() => transcriptionJobs.id, {
      onDelete: "set null",
    }),
    publicId: text("public_id").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    ownerType: text("owner_type").notNull(),
    sourceFileName: text("source_file_name").notNull(),
    sourceContentType: text("source_content_type").notNull(),
    sourceFileSize: integer("source_file_size").notNull(),
    sourceDurationMs: integer("source_duration_ms"),
    processedDurationMs: integer("processed_duration_ms"),
    failureStage: text("failure_stage").notNull(),
    errorCode: text("error_code").notNull(),
    errorMessage: text("error_message").notNull(),
    replicatePredictionId: text("replicate_prediction_id"),
    replicateVersion: text("replicate_version"),
    metadataRetainUntil: timestamp("metadata_retain_until", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    publicIdUnique: uniqueIndex("transcription_failure_archives_public_id_idx").on(table.publicId),
    failureLookupIdx: index("transcription_failure_archives_failure_lookup_idx").on(
      table.failureStage,
      table.errorCode,
      table.createdAt
    ),
    metadataRetentionIdx: index("transcription_failure_archives_metadata_retention_idx").on(
      table.metadataRetainUntil
    ),
  })
);

/** Diagnostics for failures before a transcription job can be created. */
export const transcriptionUploadFailures = pgTable(
  "transcription_upload_failures",
  {
    id: text("id").primaryKey().notNull().$defaultFn(() => nanoid()),
    requestId: text("request_id"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    anonymousSessionId: text("anonymous_session_id"),
    sourceType: text("source_type"),
    fileName: text("file_name"),
    contentType: text("content_type"),
    fileSize: integer("file_size"),
    failureStage: text("failure_stage").notNull(),
    errorCode: text("error_code").notNull(),
    errorMessage: text("error_message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("transcription_upload_failures_created_at_idx").on(table.createdAt),
    failureStageIdx: index("transcription_upload_failures_failure_stage_idx").on(table.failureStage),
    errorCodeIdx: index("transcription_upload_failures_error_code_idx").on(table.errorCode),
    userIdIdx: index("transcription_upload_failures_user_id_idx").on(table.userId),
    anonymousSessionIdx: index("transcription_upload_failures_anon_session_idx").on(table.anonymousSessionId),
  })
);

export type TranscriptionJob = typeof transcriptionJobs.$inferSelect;
export type NewTranscriptionJob = typeof transcriptionJobs.$inferInsert;
export type TranscriptionSpeaker = typeof transcriptionSpeakers.$inferSelect;
export type NewTranscriptionSpeaker = typeof transcriptionSpeakers.$inferInsert;
export type TranscriptionDisplaySegment = typeof transcriptionDisplaySegments.$inferSelect;
export type NewTranscriptionDisplaySegment =
  typeof transcriptionDisplaySegments.$inferInsert;
export type TranscriptionFeedback = typeof transcriptionFeedback.$inferSelect;
export type NewTranscriptionFeedback = typeof transcriptionFeedback.$inferInsert;
export type TranscriptionAiArtifact = typeof transcriptionAiArtifacts.$inferSelect;
export type NewTranscriptionAiArtifact = typeof transcriptionAiArtifacts.$inferInsert;
export type TranscriptionTranslationJob = typeof transcriptionTranslationJobs.$inferSelect;
export type NewTranscriptionTranslationJob = typeof transcriptionTranslationJobs.$inferInsert;
export type TranscriptionTranslationSegment = typeof transcriptionTranslationSegments.$inferSelect;
export type NewTranscriptionTranslationSegment =
  typeof transcriptionTranslationSegments.$inferInsert;
export type TranscriptionShare = typeof transcriptionShares.$inferSelect;
export type NewTranscriptionShare = typeof transcriptionShares.$inferInsert;
export type TranscriptionFailureArchive = typeof transcriptionFailureArchives.$inferSelect;
export type NewTranscriptionFailureArchive = typeof transcriptionFailureArchives.$inferInsert;
export type TranscriptionUploadFailure = typeof transcriptionUploadFailures.$inferSelect;
export type NewTranscriptionUploadFailure = typeof transcriptionUploadFailures.$inferInsert;
