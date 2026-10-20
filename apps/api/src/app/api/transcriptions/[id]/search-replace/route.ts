import { NextRequest } from "next/server";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@markless/shared/src/lib/api/response";
import { authorizeTranscriptionRead } from "@markless/server/src/lib/transcriptions/access";
import {
  replaceTextAcrossTranscriptionDisplaySegments,
  serializeTranscriptionJob,
} from "@markless/server/src/lib/transcriptions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SearchReplaceRequest = {
  search?: string;
  replace?: string;
  matchCase?: boolean;
  wholeWord?: boolean;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const access = await authorizeTranscriptionRead(request, id);

  if ("reason" in access) {
    return errorResponse(
      access.reason === "not_found" ? "INVALID_PARAMS" : "FORBIDDEN",
      access.reason === "not_found" ? "Transcription not found" : "Access denied",
      access.reason === "not_found" ? 404 : 403
    );
  }

  const body = (await request.json().catch(() => ({}))) as SearchReplaceRequest;
  const search = String(body.search || "").trim();

  if (!search) {
    return validationErrorResponse("search is required");
  }

  try {
    const job = await replaceTextAcrossTranscriptionDisplaySegments(id, {
      search,
      replace: String(body.replace || ""),
      matchCase: body.matchCase === true,
      wholeWord: body.wholeWord === true,
    });

    if (!job) {
      return errorResponse("INVALID_PARAMS", "Transcription not found", 404);
    }

    return successResponse({
      task: await serializeTranscriptionJob(job),
    });
  } catch (error) {
    return validationErrorResponse(
      error instanceof Error ? error.message : "Failed to replace transcript text"
    );
  }
}
