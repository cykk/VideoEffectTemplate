import { nanoid } from "nanoid";
import { ASYNC_TASK_STATUS } from "@markless/shared/src/constants/async-task-status";
import { redis, ensureRedisConnected, pushUserEvent } from "@markless/server/src/lib/redis/client-v2";
import { buildTaskEventChannel } from "@markless/shared/src/lib/async-tasks/task-channel";
import { saveTaskSnapshot } from "@markless/server/src/lib/async-tasks/task-snapshot-store";
import type {
  AsyncTaskEvent,
  AsyncTaskEventPayload,
  AsyncTaskKind,
} from "@markless/shared/src/lib/async-tasks/task-types";

function buildTaskEvent(
  userId: string,
  taskId: string,
  kind: AsyncTaskKind,
  status: AsyncTaskEvent["status"],
  payload: Omit<AsyncTaskEventPayload, "taskId" | "kind"> = {},
): AsyncTaskEvent {
  return {
    taskId,
    userId,
    kind,
    status,
    progress: payload.progress,
    message: payload.message,
    result: payload.result ?? null,
    error: payload.error ?? null,
    updatedAt: new Date().toISOString(),
  };
}

export async function publishTaskEvent(
  userId: string,
  taskId: string,
  kind: AsyncTaskKind,
  status: AsyncTaskEvent["status"],
  payload: Omit<AsyncTaskEventPayload, "taskId" | "kind"> = {},
): Promise<AsyncTaskEvent> {
  const event = buildTaskEvent(userId, taskId, kind, status, payload);

  await saveTaskSnapshot(event);

  const eventId = `${taskId}:${status}:${nanoid(6)}`;
  await pushUserEvent(eventId, userId, {
    type: `task.${status}`,
    status,
    payload: {
      taskId: event.taskId,
      kind: event.kind,
      progress: event.progress,
      message: event.message,
      result: event.result,
      error: event.error,
    },
  });

  return event;
}

export async function publishQueuedTask(
  userId: string,
  taskId: string,
  kind: AsyncTaskKind,
  message = "Task queued",
) {
  return publishTaskEvent(userId, taskId, kind, ASYNC_TASK_STATUS.QUEUED, {
    message,
    progress: 0,
  });
}

export async function publishStartedTask(
  userId: string,
  taskId: string,
  kind: AsyncTaskKind,
  message = "Task started",
) {
  return publishTaskEvent(userId, taskId, kind, ASYNC_TASK_STATUS.PROCESSING, {
    message,
    progress: 10,
  });
}

export async function publishProgressTask(
  userId: string,
  taskId: string,
  kind: AsyncTaskKind,
  progress: number,
  message: string,
) {
  return publishTaskEvent(userId, taskId, kind, ASYNC_TASK_STATUS.PROCESSING, {
    progress,
    message,
  });
}

export async function publishSucceededTask(
  userId: string,
  taskId: string,
  kind: AsyncTaskKind,
  result: Record<string, unknown>,
  message = "Task completed",
) {
  return publishTaskEvent(userId, taskId, kind, ASYNC_TASK_STATUS.SUCCEEDED, {
    progress: 100,
    message,
    result,
  });
}

export async function publishFailedTask(
  userId: string,
  taskId: string,
  kind: AsyncTaskKind,
  errorMessage: string,
  code = "TASK_FAILED",
) {
  return publishTaskEvent(userId, taskId, kind, ASYNC_TASK_STATUS.FAILED, {
    error: {
      code,
      message: errorMessage,
    },
  });
}

export async function publishTaskHeartbeat(
  userId: string,
  taskId: string,
): Promise<void> {
  if (!redis) {
    return;
  }

  if (!(await ensureRedisConnected())) {
    return;
  }

  try {
    await redis.publish(
      buildTaskEventChannel(userId, taskId),
      JSON.stringify({ type: "heartbeat", timestamp: new Date().toISOString() }),
    );
  } catch (error) {
    console.error("[Async Task Publisher] Failed to publish heartbeat:", error);
  }
}
