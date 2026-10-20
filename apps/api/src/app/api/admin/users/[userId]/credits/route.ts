import {
  errorResponse,
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from "@markless/shared/src/lib/api/response";
import { ADMIN_USER_CREDITS_DEFAULT_PAGE_SIZE } from "@markless/shared/src/lib/credits/admin-user-credits";
import { requireAdminSession } from "@markless/server/src/lib/admin/require-admin-session";
import {
  getAdminUserCreditsDetail,
  resolveAdminUserCreditsPageSize,
} from "@markless/server/src/lib/admin/get-admin-user-credits-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const admin = await requireAdminSession(request.headers);
    if (!admin) {
      return unauthorizedResponse("Admin access required");
    }

    const { userId } = await context.params;
    const trimmedUserId = userId?.trim();
    if (!trimmedUserId) {
      return errorResponse("INVALID_PARAMS", "User id is required", 400);
    }

    const { searchParams } = new URL(request.url);
    const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const requestedPageSize = Number.parseInt(
      searchParams.get("pageSize") ?? String(ADMIN_USER_CREDITS_DEFAULT_PAGE_SIZE),
      10
    );
    const page =
      Number.isNaN(requestedPage) || requestedPage < 1 ? 1 : requestedPage;
    const pageSize = resolveAdminUserCreditsPageSize(requestedPageSize);

    const detail = await getAdminUserCreditsDetail({
      userId: trimmedUserId,
      page,
      pageSize,
    });

    if (!detail) {
      return errorResponse("INVALID_PARAMS", "User not found", 404);
    }

    return successResponse(detail);
  } catch (error) {
    console.error("[Admin User Credits API] Failed to load credits:", error);
    return internalErrorResponse();
  }
}
