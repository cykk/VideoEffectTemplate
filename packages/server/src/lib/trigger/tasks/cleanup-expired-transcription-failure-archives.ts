import { queue, schedules } from "@trigger.dev/sdk/v3";
import { cleanupExpiredTranscriptionFailureArchives } from "@markless/server/src/lib/transcriptions/failure-archive";
import { RUN_CLEANUP_EXPIRED_TRANSCRIPTION_FAILURE_ARCHIVES_TASK_ID } from "@markless/shared/src/lib/trigger/task-ids";
import { isTranscriptionFailureArchiveCleanupEnabled } from "@markless/shared/src/lib/config/env";

const cleanupQueue = queue({
  name: "maintenance-cleanup-transcription-failure-archives",
  concurrencyLimit: 1,
});

export const runCleanupExpiredTranscriptionFailureArchivesTask = schedules.task({
  id: RUN_CLEANUP_EXPIRED_TRANSCRIPTION_FAILURE_ARCHIVES_TASK_ID,
  queue: cleanupQueue,
  maxDuration: 900,
  retry: { maxAttempts: 3 },
  cron: {
    pattern: "30 0 * * 1",
    timezone: "UTC",
    environments: ["PRODUCTION"],
  },
  run: async (payload) => {
    if (!isTranscriptionFailureArchiveCleanupEnabled()) {
      return {
        scheduleId: payload.scheduleId,
        timestamp: payload.timestamp,
        ranAt: new Date().toISOString(),
        skipped: true,
        reason: "failure_archive_cleanup_disabled",
      };
    }

    const result = await cleanupExpiredTranscriptionFailureArchives();

    return {
      scheduleId: payload.scheduleId,
      timestamp: payload.timestamp,
      ranAt: new Date().toISOString(),
      result,
    };
  },
});
