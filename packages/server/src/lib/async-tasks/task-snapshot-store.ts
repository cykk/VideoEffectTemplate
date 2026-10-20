import { redis, ensureRedisConnected } from "@markless/server/src/lib/redis/client-v2";
import { buildTaskSnapshotKey } from "@markless/shared/src/lib/async-tasks/task-channel";
import type { AsyncTaskEvent } from "@markless/shared/src/lib/async-tasks/task-types";

const TASK_SNAPSHOT_TTL_SECONDS = 60 * 60;

export async function saveTaskSnapshot(event: AsyncTaskEvent): Promise<void> {
  if (!redis) {
    return;
  }

  if (!(await ensureRedisConnected())) {
    return;
  }

  try {
    await redis.set(
      buildTaskSnapshotKey(event.userId, event.taskId),
      JSON.stringify(event),
      "EX",
      TASK_SNAPSHOT_TTL_SECONDS,
    );
  } catch (error) {
    console.error("[Async Task Snapshot] Failed to save snapshot:", error);
  }
}

export async function getTaskSnapshot(
  userId: string,
  taskId: string,
): Promise<AsyncTaskEvent | null> {
  if (!redis) {
    return null;
  }

  if (!(await ensureRedisConnected())) {
    return null;
  }

  try {
    const raw = await redis.get(buildTaskSnapshotKey(userId, taskId));
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as AsyncTaskEvent;
  } catch (error) {
    console.error("[Async Task Snapshot] Failed to read snapshot:", error);
    return null;
  }
}
