import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@markless/shared/src/lib/api/response";
import { authorizeTranscriptionRead } from "@markless/server/src/lib/transcriptions/access";
import { getTranscriptionTranslationDetail } from "@markless/server/src/lib/transcriptions/translations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
    language: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { id, language } = await context.params;
  const access = await authorizeTranscriptionRead(request, id);

  if ("reason" in access) {
    return errorResponse(
      access.reason === "not_found" ? "INVALID_PARAMS" : "FORBIDDEN",
      access.reason === "not_found" ? "Transcription not found" : "Access denied",
      access.reason === "not_found" ? 404 : 403
    );
  }

  const translation = await getTranscriptionTranslationDetail(
    access.job.id,
    language.trim().toLowerCase(),
    access.job.displayVersion
  );

  if (!translation) {
    return errorResponse("INVALID_PARAMS", "Translation not found", 404);
  }

  return successResponse({
    translation,
  });
}
