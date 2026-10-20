import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@markless/server/src/lib/db";
import {
  transcriptionJobs,
  transcriptionShares,
  type TranscriptionJob,
  type TranscriptionShare,
} from "@markless/server/src/lib/db/schema/transcriptions";
import {
  isTranscriptionJobExpired,
  resolveTranscriptionPlaybackUrl,
  serializeTranscriptionJob,
} from "@markless/server/src/lib/transcriptions/service";
import { serializeTranscriptionAiArtifacts } from "@markless/server/src/lib/transcriptions/ai-artifacts";
import {
  getTranscriptionTranslationDetail,
  serializeTranscriptionTranslations,
} from "@markless/server/src/lib/transcriptions/translations";
import {
  buildTranscriptionExportFile,
  type TranscriptionExportOptions,
} from "@markless/server/src/lib/transcriptions/export-service";
import { buildWebUrl } from "@markless/shared/src/lib/config/urls";
import type {
  PublicTranscriptionShareReadResponse,
  TranscriptionShareClientData,
  TranscriptionTranslationCollectionClientData,
} from "@markless/shared/src/types/transcriptions";

function toIsoString(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function createPublicShareToken(): string {
  return randomUUID().toLowerCase();
}

function isShareAccessible(share: TranscriptionShare): boolean {
  if (share.visibility !== "public_link") {
    return false;
  }

  if (share.isRevoked) {
    return false;
  }

  if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) {
    return false;
  }

  return true;
}

function buildShareUrl(shareToken: string): string {
  return buildWebUrl(`/share/${shareToken}`);
}

function serializeOwnerShare(
  share: TranscriptionShare | null
): TranscriptionShareClientData {
  const enabled = Boolean(share && isShareAccessible(share));

  return {
    enabled,
    visibility: enabled ? "public_link" : "private",
    shareUrl: enabled && share ? buildShareUrl(share.shareToken) : null,
    allowCopy: share?.allowCopy ?? true,
    allowAudioPlayback: share?.allowAudioPlayback ?? true,
    viewCount: share?.viewCount ?? 0,
    createdAt: toIsoString(share?.createdAt),
    updatedAt: toIsoString(share?.updatedAt),
    lastAccessedAt: toIsoString(share?.lastAccessedAt),
    expiresAt: toIsoString(share?.expiresAt),
  };
}

function filterCompletedPublicTranslations(
  translations: TranscriptionTranslationCollectionClientData
): TranscriptionTranslationCollectionClientData {
  const filtered: TranscriptionTranslationCollectionClientData = {};

  for (const [language, translation] of Object.entries(translations)) {
    if (translation.status === "completed") {
      filtered[language] = translation;
    }
  }

  return filtered;
}

export async function getOwnerTranscriptionShare(input: {
  publicId: string;
  userId: string;
}): Promise<TranscriptionShareClientData | null> {
  const job = await db.query.transcriptionJobs.findFirst({
    where: and(
      eq(transcriptionJobs.publicId, input.publicId),
      eq(transcriptionJobs.userId, input.userId)
    ),
  });

  if (!job || isTranscriptionJobExpired(job)) {
    return null;
  }

  const share = await db.query.transcriptionShares.findFirst({
    where: eq(transcriptionShares.transcriptionJobId, job.id),
  });

  return serializeOwnerShare(share ?? null);
}

export async function enableOwnerTranscriptionShare(input: {
  publicId: string;
  userId: string;
}): Promise<TranscriptionShareClientData | null> {
  const job = await db.query.transcriptionJobs.findFirst({
    where: and(
      eq(transcriptionJobs.publicId, input.publicId),
      eq(transcriptionJobs.userId, input.userId)
    ),
  });

  if (!job || isTranscriptionJobExpired(job)) {
    return null;
  }

  const now = new Date();
  const existing = await db.query.transcriptionShares.findFirst({
    where: eq(transcriptionShares.transcriptionJobId, job.id),
  });

  let share: TranscriptionShare | null = null;

  if (!existing) {
    const [created] = await db
      .insert(transcriptionShares)
      .values({
        transcriptionJobId: job.id,
        ownerUserId: input.userId,
        visibility: "public_link",
        shareToken: createPublicShareToken(),
        isRevoked: false,
        allowCopy: true,
        allowAudioPlayback: true,
        updatedAt: now,
      })
      .returning();

    share = created ?? null;
  } else {
    const shouldRotateToken =
      existing.isRevoked || existing.visibility !== "public_link";

    const [updated] = await db
      .update(transcriptionShares)
      .set({
        visibility: "public_link",
        isRevoked: false,
        allowCopy: true,
        allowAudioPlayback: true,
        shareToken: shouldRotateToken
          ? createPublicShareToken()
          : existing.shareToken,
        updatedAt: now,
      })
      .where(eq(transcriptionShares.id, existing.id))
      .returning();

    share = updated ?? null;
  }

  return serializeOwnerShare(share);
}

export async function revokeOwnerTranscriptionShare(input: {
  publicId: string;
  userId: string;
}): Promise<TranscriptionShareClientData | null> {
  const job = await db.query.transcriptionJobs.findFirst({
    where: and(
      eq(transcriptionJobs.publicId, input.publicId),
      eq(transcriptionJobs.userId, input.userId)
    ),
  });

  if (!job || isTranscriptionJobExpired(job)) {
    return null;
  }

  const existing = await db.query.transcriptionShares.findFirst({
    where: eq(transcriptionShares.transcriptionJobId, job.id),
  });

  if (!existing) {
    return serializeOwnerShare(null);
  }

  const [updated] = await db
    .update(transcriptionShares)
    .set({
      visibility: "private",
      isRevoked: true,
      updatedAt: new Date(),
    })
    .where(eq(transcriptionShares.id, existing.id))
    .returning();

  return serializeOwnerShare(updated ?? existing);
}

async function loadAccessiblePublicShare(
  shareToken: string,
  options: {
    touchAccess?: boolean;
  } = {}
): Promise<{
  share: TranscriptionShare;
  job: TranscriptionJob;
} | null> {
  const share = await db.query.transcriptionShares.findFirst({
    where: eq(transcriptionShares.shareToken, shareToken),
  });

  if (!share || !isShareAccessible(share)) {
    return null;
  }

  const job = await db.query.transcriptionJobs.findFirst({
    where: eq(transcriptionJobs.id, share.transcriptionJobId),
  });

  if (!job || isTranscriptionJobExpired(job)) {
    return null;
  }

  if (options.touchAccess) {
    const [updatedShare] = await db
      .update(transcriptionShares)
      .set({
        viewCount: sql`${transcriptionShares.viewCount} + 1`,
        lastAccessedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(transcriptionShares.id, share.id))
      .returning();

    if (updatedShare) {
      return {
        share: updatedShare,
        job,
      };
    }
  }

  return {
    share,
    job,
  };
}

export async function getPublicTranscriptionShareReadResponse(
  shareToken: string
): Promise<PublicTranscriptionShareReadResponse | null> {
  const resolved = await loadAccessiblePublicShare(shareToken, {
    touchAccess: true,
  });

  if (!resolved) {
    return null;
  }

  const [task, aiArtifacts, translations, playback] = await Promise.all([
    serializeTranscriptionJob(resolved.job),
    serializeTranscriptionAiArtifacts(resolved.job.id, resolved.job.displayVersion),
    serializeTranscriptionTranslations(resolved.job.id, resolved.job.displayVersion),
    resolved.share.allowAudioPlayback
      ? resolveTranscriptionPlaybackUrl(resolved.job).catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    share: {
      allowCopy: resolved.share.allowCopy,
      allowAudioPlayback: resolved.share.allowAudioPlayback,
      expiresAt: toIsoString(resolved.share.expiresAt),
    },
    task,
    aiArtifacts,
    translations: filterCompletedPublicTranslations(translations),
    playbackUrl: playback?.url ?? null,
  };
}

export async function getPublicTranscriptionTranslationDetail(input: {
  shareToken: string;
  targetLanguage: string;
}) {
  const resolved = await loadAccessiblePublicShare(input.shareToken);
  if (!resolved) {
    return null;
  }

  const detail = await getTranscriptionTranslationDetail(
    resolved.job.id,
    input.targetLanguage,
    resolved.job.displayVersion
  );

  if (!detail || detail.status !== "completed") {
    return null;
  }

  return detail;
}

export async function buildPublicTranscriptionShareExportFile(
  shareToken: string,
  options: TranscriptionExportOptions
) {
  const resolved = await loadAccessiblePublicShare(shareToken);
  if (!resolved) {
    return null;
  }

  return buildTranscriptionExportFile(resolved.job, options);
}
