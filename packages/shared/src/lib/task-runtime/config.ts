import { getEnv } from "../config/env";
import type { TaskRuntimeProvider, TaskRuntimeStatus } from "./types";

function isTriggerConfigured(): boolean {
  return Boolean(getEnv("TRIGGER_PROJECT_REF") && getEnv("TRIGGER_SECRET_KEY"));
}

export function getConfiguredTaskRuntimeProvider(): TaskRuntimeProvider {
  return isTriggerConfigured() ? "trigger" : "none";
}

export function getTaskRuntimeStatus(): TaskRuntimeStatus {
  const provider = getConfiguredTaskRuntimeProvider();

  if (provider === "trigger") {
    return {
      provider,
      label: "Trigger.dev",
      configured: true,
    };
  }

  return {
    provider: "none",
    label: "Trigger.dev",
    configured: false,
  };
}
