import { buildRedisChannel, buildRedisKey } from "@markless/shared/src/lib/redis/namespace";

export function buildTaskEventChannel(userId: string, taskId: string): string {
  return buildRedisChannel("event", "user", userId, "task", taskId);
}

export function buildTaskSnapshotKey(userId: string, taskId: string): string {
  return buildRedisKey("task", "snapshot", userId, taskId);
}
