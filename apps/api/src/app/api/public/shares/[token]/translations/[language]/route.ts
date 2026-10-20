import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@markless/shared/src/lib/api/response";
import { getPublicTranscriptionTranslationDetail } from "@markless/server/src/lib/transcriptions/shares";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    token: string;
    language: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { token, language } = await context.params;
  const translation = await getPublicTranscriptionTranslationDetail({
    shareToken: token,
    targetLanguage: language.trim().toLowerCase(),
  });

  if (!translation) {
    return errorResponse("INVALID_PARAMS", "Translation not found", 404);
  }

  return successResponse({
    translation,
  });
}
