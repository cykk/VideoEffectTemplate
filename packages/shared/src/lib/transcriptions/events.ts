import { nanoid } from "nanoid";
import {
  ensureRedisReadyForPublish,
  pushUserEvent,
  redis,
} from "@markless/server/src/lib/redis/client-v2";
import type {
  TranscriptionAiArtifactCollectionClientData,
  TranscriptionJobClientData,
  TranscriptionTranslationClientData,
  TranscriptionTranslationCollectionClientData,
} from "@markless/shared/src/types/transcriptions";
import { buildRedisChannel } from "@markless/shared/src/lib/redis/namespace";

export function buildTranscriptionEventChannel(publicId: string): string {
  return buildRedisChannel("event", "transcription", publicId);
}

export type TranscriptionRealtimeUpdatePayload = {
  type: "transcription.updated";
  task: TranscriptionJobClientData;
  aiArtifacts: TranscriptionAiArtifactCollectionClientData;
  translations: TranscriptionTranslationCollectionClientData;
  completedTranslation?: TranscriptionTranslationClientData | null;
};

export async function publishTranscriptionRealtimeUpdate(
  task: TranscriptionJobClientData,
  userId?: string | null,
  aiArtifacts?: TranscriptionAiArtifactCollectionClientData,
  translations?: TranscriptionTranslationCollectionClientData,
  completedTranslation?: TranscriptionTranslationClientData | null
): Promise<void> {
  const payload: TranscriptionRealtimeUpdatePayload = {
    type: "transcription.updated",
    task,
    aiArtifacts: aiArtifacts ?? {
      summary: null,
      mind_map: null,
    },
    translations: translations ?? {},
    completedTranslation: completedTranslation ?? null,
  };
  const message = JSON.stringify(payload);

  if (redis) {
    const initialRedisStatus = redis.status;
    const startedAt = Date.now();
    const available = await ensureRedisReadyForPublish();

    if (available) {
      try {
        const subscribers = await redis.publish(buildTranscriptionEventChannel(task.publicId), message);
        console.log("[Transcriptions] Published realtime update", {
          publicId: task.publicId,
          status: task.status,
          initialRedisStatus,
          waitMs: Date.now() - startedAt,
          subscribers,
        });
      } catch (error) {
        console.error("[Transcriptions] Failed to publish realtime update", {
          publicId: task.publicId,
          status: task.status,
          initialRedisStatus,
          waitMs: Date.now() - startedAt,
          error,
        });
      }
    } else {
      console.warn("[Transcriptions] Skipped realtime update because Redis was unavailable", {
        publicId: task.publicId,
        status: task.status,
        initialRedisStatus,
        finalRedisStatus: redis.status,
        waitMs: Date.now() - startedAt,
      });
    }
  }

  if (userId) {
    await pushUserEvent(`transcription:${task.publicId}:${nanoid(6)}`, userId, {
      type: "transcription.updated",
      status: task.status,
      payload,
    });
  }
}
