import { NextRequest } from "next/server";
import { auth } from "@markless/server/src/lib/auth/server";
import { successResponse, unauthorizedResponse, validationErrorResponse, errorResponse } from "@markless/shared/src/lib/api/response";
import { getTaskSnapshot } from "@markless/server/src/lib/async-tasks/task-snapshot-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return unauthorizedResponse();
    }

    const taskId = req.nextUrl.searchParams.get("taskId")?.trim();
    if (!taskId) {
      return validationErrorResponse("Missing taskId");
    }

    const snapshot = await getTaskSnapshot(session.user.id, taskId);

    return successResponse({
      task: snapshot,
    });
  } catch (error) {
    console.error("[Tasks Snapshot] Failed to load snapshot:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to load task snapshot", 500);
  }
}
