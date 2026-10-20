import {
  internalErrorResponse,
  successResponse,
  unauthorizedResponse,
} from "@markless/shared/src/lib/api/response";
import {
  ADMIN_TRANSCRIPTIONS_PAGE_SIZE,
  ADMIN_TRANSCRIPTIONS_PAGE_SIZES,
  type AdminTranscriptionOwnerFilter,
  type AdminTranscriptionStatusFilter,
} from "@markless/shared/src/lib/transcriptions/admin-list";
import { requireAdminSession } from "@markless/server/src/lib/admin/require-admin-session";
import { listAdminTranscriptionJobs } from "@markless/server/src/lib/transcriptions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseOwnerType(value: string | null): AdminTranscriptionOwnerFilter | undefined {
  if (value === "guest" || value === "registered") {
    return value;
  }
  return undefined;
}

function parseStatusFilter(value: string | null): AdminTranscriptionStatusFilter | undefined {
  if (value === "succeeded" || value === "failed") {
    return value;
  }
  return undefined;
}

function parsePageSize(value: string | null, fallback: number): number {
  const parsed = parsePositiveInt(value, fallback);
  const allowed = ADMIN_TRANSCRIPTIONS_PAGE_SIZES as readonly number[];
  if (allowed.includes(parsed)) {
    return parsed;
  }
  return fallback;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdminSession(request.headers);
    if (!admin) {
      return unauthorizedResponse("Admin access required");
    }

    const { searchParams } = new URL(request.url);
    const requestedPage = parsePositiveInt(searchParams.get("page") ?? "1", 1);
    const pageSize = parsePageSize(
      searchParams.get("pageSize"),
      ADMIN_TRANSCRIPTIONS_PAGE_SIZE
    );
    const query = searchParams.get("q")?.trim() || undefined;
    const ownerType = parseOwnerType(searchParams.get("ownerType"));
    const status = parseStatusFilter(searchParams.get("status"));

    let { items, totalCount } = await listAdminTranscriptionJobs({
      limit: pageSize,
      offset: (requestedPage - 1) * pageSize,
      query,
      ownerType,
      status,
    });

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.min(requestedPage, totalPages);

    if (currentPage !== requestedPage) {
      ({ items, totalCount } = await listAdminTranscriptionJobs({
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        query,
        ownerType,
        status,
      }));
    }

    return successResponse({
      items,
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
    console.error("[Admin Transcriptions API] Failed to load transcriptions:", error);
    return internalErrorResponse();
  }
}
