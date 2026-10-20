"use client";

import { getWebAnalyticsClient } from "@/lib/analytics/ga";

type SourceType = "audio" | "video";
type UploadSurface = "hero" | "dashboard" | "result";

function uploadFileSizeBucket(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "unknown";
  if (bytes <= 25 * 1024 * 1024) return "0_25mb";
  if (bytes <= 100 * 1024 * 1024) return "25_100mb";
  return "100mb_plus";
}

function trackUploadEvent(name: string, input: {
  sourceType?: SourceType | "unknown";
  isAuthenticated: boolean;
  entrySurface: UploadSurface;
  fileSize?: number | null;
  failureStage?: string;
  dedupeKey: string;
}) {
  getWebAnalyticsClient().track({
    name,
    dedupeKey: input.dedupeKey,
    params: {
      source_type: input.sourceType ?? "unknown",
      is_authenticated: input.isAuthenticated,
      entry_surface: input.entrySurface,
      file_size_bucket: uploadFileSizeBucket(input.fileSize),
      failure_stage: input.failureStage,
    },
  });
}

export function trackUploadCtaClicked(input: { entrySurface: UploadSurface; isAuthenticated: boolean }) {
  trackUploadEvent("upload_cta_clicked", { ...input, dedupeKey: `upload_cta_clicked:${input.entrySurface}` });
}

export function trackFileSelected(input: { sourceType: SourceType; fileSize: number; entrySurface: UploadSurface; isAuthenticated: boolean; dedupeKey: string }) {
  trackUploadEvent("file_selected", input);
}

export function trackUploadStarted(input: { sourceType: SourceType; fileSize: number; entrySurface: UploadSurface; isAuthenticated: boolean; dedupeKey: string }) {
  trackUploadEvent("upload_started", input);
}

export function trackUploadCompleted(input: { sourceType: SourceType; fileSize: number; entrySurface: UploadSurface; isAuthenticated: boolean; dedupeKey: string }) {
  trackUploadEvent("upload_completed", input);
}

export function trackUploadFailed(input: { sourceType?: SourceType | "unknown"; fileSize?: number | null; entrySurface: UploadSurface; isAuthenticated: boolean; failureStage: string; dedupeKey: string }) {
  trackUploadEvent("upload_failed", input);
}

function durationBucket(durationMs: number | null | undefined): string {
  if (!durationMs || durationMs <= 0) return "unknown";
  if (durationMs <= 5 * 60_000) return "0_5m";
  if (durationMs <= 30 * 60_000) return "5_30m";
  if (durationMs <= 60 * 60_000) return "30_60m";
  return "60m_plus";
}

function fileSizeBucket(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "unknown";
  if (bytes <= 25 * 1024 * 1024) return "0_25mb";
  if (bytes <= 100 * 1024 * 1024) return "25_100mb";
  if (bytes <= 500 * 1024 * 1024) return "100_500mb";
  return "500mb_plus";
}

export function trackTranscriptionStarted(input: {
  sourceType: SourceType;
  inputMethod: "upload" | "link";
  isAuthenticated: boolean;
  durationMs?: number | null;
  fileSize?: number | null;
  dedupeKey: string;
}) {
  getWebAnalyticsClient().track({
    name: "transcription_started",
    dedupeKey: input.dedupeKey,
    params: {
      source_type: input.sourceType,
      input_method: input.inputMethod,
      is_authenticated: input.isAuthenticated,
      duration_bucket: durationBucket(input.durationMs),
      file_size_bucket: fileSizeBucket(input.fileSize),
    },
  });
}

export function trackTranscriptionCompleted(input: {
  sourceType: SourceType;
  durationMs?: number | null;
  isAuthenticated: boolean;
  dedupeKey: string;
}) {
  getWebAnalyticsClient().track({
    name: "transcription_completed",
    dedupeKey: input.dedupeKey,
    params: {
      source_type: input.sourceType,
      duration_bucket: durationBucket(input.durationMs),
      is_authenticated: input.isAuthenticated,
    },
  });
}

export function trackTranscriptionFailed(input: {
  sourceType: SourceType;
  failureStage: string;
  isAuthenticated: boolean;
  dedupeKey: string;
}) {
  getWebAnalyticsClient().track({
    name: "transcription_failed",
    dedupeKey: input.dedupeKey,
    params: {
      source_type: input.sourceType,
      failure_stage: input.failureStage,
      is_authenticated: input.isAuthenticated,
    },
  });
}

export function trackTranscriptExport(input: {
  format: string;
  isAuthenticated: boolean;
  source: "result" | "dashboard" | "share";
  succeeded: boolean;
  dedupeKey: string;
}) {
  getWebAnalyticsClient().track({
    name: input.succeeded ? "transcript_export_completed" : "transcript_export_started",
    dedupeKey: input.dedupeKey,
    params: {
      export_format: input.format,
      is_authenticated: input.isAuthenticated,
      export_source: input.source,
    },
  });
}

export function trackTranslationCompleted(input: {
  targetLanguage: string;
  isAuthenticated: boolean;
  dedupeKey: string;
}) {
  getWebAnalyticsClient().track({
    name: "translation_completed",
    dedupeKey: input.dedupeKey,
    params: {
      target_language: input.targetLanguage,
      is_authenticated: input.isAuthenticated,
    },
  });
}

export function trackTranscriptionSubscriptionClicked(input: {
  entrySurface: string;
  billingPeriod: "yearly" | "monthly";
  productId: string;
  isAuthenticated: boolean;
}) {
  getWebAnalyticsClient().track({
    name: "transcription_subscription_clicked",
    dedupeKey: `transcription_subscription:${input.entrySurface}:${input.productId}`,
    params: {
      entry_surface: input.entrySurface,
      billing_period: input.billingPeriod,
      product_id: input.productId,
      is_authenticated: input.isAuthenticated,
    },
  });
}

export function trackTranscriptionGuestAuthClicked(input: {
  action: "upload" | "paste_link" | "save_transcript";
  dedupeKey: string;
}) {
  getWebAnalyticsClient().track({
    name: "transcription_guest_auth_clicked",
    dedupeKey: input.dedupeKey,
    params: {
      entry_surface: "guest_sidebar",
      action: input.action,
      auth_intent: "sign_up",
    },
  });
}
