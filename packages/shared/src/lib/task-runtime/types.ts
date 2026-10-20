export type TaskRuntimeProvider = "trigger" | "none";

export interface TaskRuntimeStatus {
  provider: TaskRuntimeProvider;
  label: string;
  configured: boolean;
}
