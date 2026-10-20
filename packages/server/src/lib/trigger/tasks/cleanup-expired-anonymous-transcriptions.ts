import { queue, schedules } from "@trigger.dev/sdk/v3";
import { cleanupExpiredAnonymousTranscriptionJobs } from "@markless/server/src/lib/transcriptions/service";
import { RUN_CLEANUP_EXPIRED_ANONYMOUS_TRANSCRIPTIONS_TASK_ID } from "@markless/shared/src/lib/trigger/task-ids";
import { isAnonymousTranscriptionCleanupEnabled } from "@markless/shared/src/lib/config/env";

const cleanupQueue = queue({
  name: "maintenance-cleanup-expired-anonymous-transcriptions",
  concurrencyLimit: 1,
});

export const runCleanupExpiredAnonymousTranscriptionsTask = schedules.task({
  id: RUN_CLEANUP_EXPIRED_ANONYMOUS_TRANSCRIPTIONS_TASK_ID,
  queue: cleanupQueue,
  maxDuration: 900,
  retry: {
    maxAttempts: 3,
  },
  cron: {
    pattern: "0 */12 * * *",
    timezone: "UTC",
    environments: ["PRODUCTION"],
  },
  run: async (payload) => {
    if (!isAnonymousTranscriptionCleanupEnabled()) {
      return {
        scheduleId: payload.scheduleId,
        timestamp: payload.timestamp,
        ranAt: new Date().toISOString(),
        skipped: true,
        reason: "anonymous_cleanup_disabled",
      };
    }
    const result = await cleanupExpiredAnonymousTranscriptionJobs();

    return {
      scheduleId: payload.scheduleId,
      timestamp: payload.timestamp,
      ranAt: new Date().toISOString(),
      result,
    };
  },
});
