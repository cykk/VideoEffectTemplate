export const ASYNC_TASK_STATUS = {
  QUEUED: "queued",
  PROCESSING: "processing",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type AsyncTaskStatus =
  typeof ASYNC_TASK_STATUS[keyof typeof ASYNC_TASK_STATUS];

export function normalizeAsyncTaskStatus(
  status?: string | null
): AsyncTaskStatus {
  switch ((status || "").toLowerCase()) {
    case "queued":
      return ASYNC_TASK_STATUS.QUEUED;
    case "starting":
    case "processing":
      return ASYNC_TASK_STATUS.PROCESSING;
    case "succeeded":
    case "success":
    case "completed":
      return ASYNC_TASK_STATUS.SUCCEEDED;
    case "failed":
      return ASYNC_TASK_STATUS.FAILED;
    case "canceled":
    case "cancelled":
      return ASYNC_TASK_STATUS.CANCELLED;
    default:
      return ASYNC_TASK_STATUS.PROCESSING;
  }
}

export function isActiveAsyncTaskStatus(status?: string | null): boolean {
  const normalized = normalizeAsyncTaskStatus(status);
  return (
    normalized === ASYNC_TASK_STATUS.QUEUED ||
    normalized === ASYNC_TASK_STATUS.PROCESSING
  );
}

export function isTerminalAsyncTaskStatus(status?: string | null): boolean {
  const normalized = normalizeAsyncTaskStatus(status);
  return (
    normalized === ASYNC_TASK_STATUS.SUCCEEDED ||
    normalized === ASYNC_TASK_STATUS.FAILED ||
    normalized === ASYNC_TASK_STATUS.CANCELLED
  );
}
