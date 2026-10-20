import { count, desc, eq } from "drizzle-orm";
import { successResponse, unauthorizedResponse, internalErrorResponse } from "@markless/shared/src/lib/api/response";
import { db } from "@markless/server/src/lib/db";
import { contactMessages, users } from "@markless/server/src/lib/db/schema";
import { requireAdminSession } from "@markless/server/src/lib/admin/require-admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  try {
    const admin = await requireAdminSession(request.headers);
    if (!admin) {
      return unauthorizedResponse("Admin access required");
    }

    const { searchParams } = new URL(request.url);
    const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const requestedPageSize = Number.parseInt(
      searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE),
      10,
    );
    const safeRequestedPage =
      Number.isNaN(requestedPage) || requestedPage < 1 ? 1 : requestedPage;
    const pageSize =
      Number.isNaN(requestedPageSize) || requestedPageSize < 1
        ? DEFAULT_PAGE_SIZE
        : Math.min(requestedPageSize, MAX_PAGE_SIZE);

    const [totalResult] = await db
      .select({ count: count() })
      .from(contactMessages);

    const totalCount = Number(totalResult?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.min(safeRequestedPage, totalPages);
    const offset = (currentPage - 1) * pageSize;

    const rawRows = await db
      .select({
        id: contactMessages.id,
        status: contactMessages.status,
        userId: contactMessages.userId,
        anonymousId: contactMessages.anonymousId,
        email: contactMessages.email,
        message: contactMessages.message,
        metadata: contactMessages.metadata,
        userDisplayName: users.displayName,
        userName: users.name,
        userEmail: users.email,
        createdAt: contactMessages.createdAt,
      })
      .from(contactMessages)
      .leftJoin(users, eq(users.id, contactMessages.userId))
      .orderBy(desc(contactMessages.createdAt), desc(contactMessages.id))
      .limit(pageSize)
      .offset(offset);

    const rows = rawRows.map((row) => ({
      id: row.id,
      status: row.status,
      email: row.email,
      message: row.message,
      reporter:
        row.userDisplayName ||
        row.userName ||
        row.userEmail ||
        row.anonymousId ||
        row.userId ||
        "-",
      metadata: row.metadata,
      createdAt: row.createdAt,
    }));

    return successResponse({
      rows,
      pagination: {
        totalCount,
        totalPages,
        currentPage,
        pageSize,
        hasPrev: currentPage > 1,
        hasNext: currentPage < totalPages,
      },
    });
  } catch (error) {
    console.error("[Admin Contact Messages API] Failed to load contact messages:", error);
    return internalErrorResponse();
  }
}
