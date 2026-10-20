import { NextRequest } from "next/server";
import { auth } from "@markless/server/src/lib/auth/server";
import { successResponse, unauthorizedResponse, internalErrorResponse } from "@markless/shared/src/lib/api/response";
import {
  DASHBOARD_TRANSCRIPTIONS_PAGE_SIZE,
} from "@markless/shared/src/lib/transcriptions/dashboard-list";
import { listDashboardTranscriptionJobs } from "@markless/server/src/lib/transcriptions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user?.id ?? null;

    if (!userId) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get("page");
    const limit = Math.min(
      parsePositiveInt(searchParams.get("limit"), DASHBOARD_TRANSCRIPTIONS_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const requestedPage = parsePositiveInt(pageParam, 1);
    const query = searchParams.get("q")?.trim() || undefined;

    let { items, totalCount } = await listDashboardTranscriptionJobs({
      userId,
      limit,
      offset: (requestedPage - 1) * limit,
      query,
    });

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const currentPage = Math.min(Math.max(1, requestedPage), totalPages);

    if (currentPage !== requestedPage) {
      ({ items } = await listDashboardTranscriptionJobs({
        userId,
        limit,
        offset: (currentPage - 1) * limit,
        query,
      }));
    }

    const response: {
      items: typeof items;
      totalCount: number;
      pagination?: {
        totalCount: number;
        totalPages: number;
        currentPage: number;
        pageSize: number;
        hasPrev: boolean;
        hasNext: boolean;
      };
    } = {
      items,
      totalCount,
    };

    if (pageParam) {
      response.pagination = {
        totalCount,
        totalPages,
        currentPage,
        pageSize: limit,
        hasPrev: currentPage > 1,
        hasNext: currentPage < totalPages,
      };
    }

    return successResponse(response);
  } catch (error) {
    console.error("[API] Failed to load dashboard transcriptions:", error);
    return internalErrorResponse("Failed to load transcription history");
  }
}
