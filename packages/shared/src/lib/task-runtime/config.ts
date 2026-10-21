import { getEnv } from "../config/env";
import enDictionary from "@markless/shared/src/i18n/locales/en.json";
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
      label: enDictionary.app.runtime.task.status.providerName,
      configured: true,
    };
  }

  return {
    provider: "none",
    label: enDictionary.app.runtime.task.status.providerName,
    configured: false,
  };
}
