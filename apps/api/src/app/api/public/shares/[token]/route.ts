import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@markless/shared/src/lib/api/response";
import { getPublicTranscriptionShareReadResponse } from "@markless/server/src/lib/transcriptions/shares";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const payload = await getPublicTranscriptionShareReadResponse(token);

  if (!payload) {
    return errorResponse("INVALID_PARAMS", "Shared transcription not found", 404);
  }

  return successResponse(payload);
}
