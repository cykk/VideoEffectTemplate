import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { internalErrorResponse, successResponse, unauthorizedResponse } from "@markless/shared/src/lib/api/response";
import { requireAdminSession } from "@markless/server/src/lib/admin/require-admin-session";
import { db } from "@markless/server/src/lib/db";
import { transcriptionFailureArchives, transcriptionUploadFailures } from "@markless/server/src/lib/db/schema/transcriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  try {
    if (!(await requireAdminSession(request.headers))) {
      return unauthorizedResponse("Admin access required");
    }

    const { searchParams } = new URL(request.url);
    const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const requestedPageSize = Number.parseInt(searchParams.get("pageSize") ?? "20", 10);
    const pageSize = Number.isNaN(requestedPageSize)
      ? DEFAULT_PAGE_SIZE
      : Math.min(Math.max(1, requestedPageSize), MAX_PAGE_SIZE);
    const archiveFilters: SQL[] = [];
    const uploadFilters: SQL[] = [];
    const failureStage = searchParams.get("stage")?.trim();
    const errorCode = searchParams.get("errorCode")?.trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (failureStage) {
      archiveFilters.push(eq(transcriptionFailureArchives.failureStage, failureStage));
      uploadFilters.push(eq(transcriptionUploadFailures.failureStage, failureStage));
    }
    if (errorCode) {
      archiveFilters.push(eq(transcriptionFailureArchives.errorCode, errorCode));
      uploadFilters.push(eq(transcriptionUploadFailures.errorCode, errorCode));
    }
    if (from && !Number.isNaN(Date.parse(from))) {
      archiveFilters.push(gte(transcriptionFailureArchives.createdAt, new Date(from)));
      uploadFilters.push(gte(transcriptionUploadFailures.createdAt, new Date(from)));
    }
    if (to && !Number.isNaN(Date.parse(to))) {
      archiveFilters.push(lte(transcriptionFailureArchives.createdAt, new Date(to)));
      uploadFilters.push(lte(transcriptionUploadFailures.createdAt, new Date(to)));
    }
    const archiveWhere = archiveFilters.length ? and(...archiveFilters) : undefined;
    const uploadWhere = uploadFilters.length ? and(...uploadFilters) : undefined;

    const [archiveCount, uploadCount] = await Promise.all([
      db.select({ count: count() }).from(transcriptionFailureArchives).where(archiveWhere),
      db.select({ count: count() }).from(transcriptionUploadFailures).where(uploadWhere),
    ]);
    const totalCount = Number(archiveCount[0]?.count ?? 0) + Number(uploadCount[0]?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.min(Math.max(1, Number.isNaN(requestedPage) ? 1 : requestedPage), totalPages);
    const [archives, uploads] = await Promise.all([
      db.query.transcriptionFailureArchives.findMany({ where: archiveWhere, orderBy: [desc(transcriptionFailureArchives.createdAt)], limit: 1000 }),
      db.query.transcriptionUploadFailures.findMany({ where: uploadWhere, orderBy: [desc(transcriptionUploadFailures.createdAt)], limit: 1000 }),
    ]);
    const rows = [
      ...archives.map((row) => ({ ...row, recordType: "transcription_failure" as const })),
      ...uploads.map((row) => ({
        id: row.id,
        recordType: "upload_failure" as const,
        publicId: null,
        transcriptionJobId: null,
        userId: row.userId,
        ownerType: row.userId ? "authenticated" : "anonymous",
        sourceFileName: row.fileName,
        sourceContentType: row.contentType,
        sourceFileSize: row.fileSize,
        sourceDurationMs: null,
        processedDurationMs: null,
        failureStage: row.failureStage,
        errorCode: row.errorCode,
        errorMessage: row.errorMessage,
        replicatePredictionId: null,
        replicateVersion: null,
        metadataRetainUntil: null,
        resolvedAt: null,
        createdAt: row.createdAt,
        updatedAt: row.createdAt,
        requestId: row.requestId,
        anonymousSessionId: row.anonymousSessionId,
        sourceType: row.sourceType,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
      .slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
    console.error("[Admin Transcription Failures API] Failed to load archives:", error);
    return internalErrorResponse();
  }
}
