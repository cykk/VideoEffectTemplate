import { successResponse, unauthorizedResponse, internalErrorResponse } from "@markless/shared/src/lib/api/response";
import { getEnv } from "@markless/shared/src/lib/config/env";
import { requireAdminSession } from "@markless/server/src/lib/admin/require-admin-session";
import { getTaskRuntimeStatus } from "@markless/server/src/lib/task-runtime";
import { getReadiness } from "@markless/server/src/lib/health/readiness";

export async function GET(request: Request) {
  try {
    const admin = await requireAdminSession(request.headers);
    if (!admin) {
      return unauthorizedResponse("Admin access required");
    }

    const redisConfigured = Boolean(getEnv("REDIS_URL"));
    const taskRuntime = getTaskRuntimeStatus();
    const readiness = await getReadiness();
    const redisHealthy = readiness.checks.some(
      (check) => check.name === "redis" && check.status === "ok"
    );

    return successResponse({
      sseEnabled: true,
      sseEndpoint: "/api/events/stream/user",
      redisConfigured,
      redisHealthy,
      taskRuntimeProvider: taskRuntime.provider,
      taskRuntimeLabel: taskRuntime.label,
      taskRuntimeConfigured: taskRuntime.configured,
      readiness,
    });
  } catch (error) {
    console.error("[Admin System API] Failed to load system status:", error);
    return internalErrorResponse();
  }
}
