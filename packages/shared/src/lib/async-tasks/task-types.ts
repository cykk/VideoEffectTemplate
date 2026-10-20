import type { AsyncTaskStatus } from "@markless/shared/src/constants/async-task-status";

export type AsyncTaskKind =
  | "report_export"
  | "data_sync"
  | "background_job";

export interface AsyncTaskErrorPayload {
  code?: string;
  message: string;
}

export interface AsyncTaskEventPayload {
  taskId: string;
  kind: AsyncTaskKind;
  progress?: number;
  message?: string;
  result?: Record<string, unknown> | null;
  error?: AsyncTaskErrorPayload | null;
}

export interface AsyncTaskEvent {
  taskId: string;
  userId: string;
  kind: AsyncTaskKind;
  status: AsyncTaskStatus;
  progress?: number;
  message?: string;
  result?: Record<string, unknown> | null;
  error?: AsyncTaskErrorPayload | null;
  updatedAt: string;
}
