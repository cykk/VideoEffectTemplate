import { resolveDurationBucket } from "./duration";

interface CreateTaskTrackerOptions {
  now?: () => number;
}

export interface TaskTrackerResult {
  durationMs: number;
  durationBucket: string;
}

export interface TaskTracker {
  start: () => void;
  finish: () => TaskTrackerResult | null;
  reset: () => void;
  getStartedAt: () => number | null;
}

export function createTaskTracker(options: CreateTaskTrackerOptions = {}): TaskTracker {
  const now = options.now || (() => Date.now());
  let startedAt: number | null = null;

  return {
    start() {
      startedAt = now();
    },
    finish() {
      if (startedAt === null) {
        return null;
      }

      const durationMs = Math.max(0, now() - startedAt);
      startedAt = null;

      return {
        durationMs,
        durationBucket: resolveDurationBucket(durationMs),
      };
    },
    reset() {
      startedAt = null;
    },
    getStartedAt() {
      return startedAt;
    },
  };
}
