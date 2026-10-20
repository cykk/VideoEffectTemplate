import { NextRequest } from "next/server";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@markless/shared/src/lib/api/response";
import { authorizeTranscriptionRead } from "@markless/server/src/lib/transcriptions/access";
import {
  requestTranscriptionTranslation,
  serializeTranscriptionTranslations,
} from "@markless/server/src/lib/transcriptions/translations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type CreateTranslationRequest = {
  targetLanguage?: string;
  force?: boolean;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const access = await authorizeTranscriptionRead(request, id);

  if ("reason" in access) {
    return errorResponse(
      access.reason === "not_found" ? "INVALID_PARAMS" : "FORBIDDEN",
      access.reason === "not_found" ? "Transcription not found" : "Access denied",
      access.reason === "not_found" ? 404 : 403
    );
  }

  return successResponse({
    translations: await serializeTranscriptionTranslations(
      access.job.id,
      access.job.displayVersion
    ),
  });
}

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

  if (access.job.status !== "succeeded" || access.job.stage !== "completed") {
    return validationErrorResponse("Transcription is not ready for translation");
  }

  const body = (await request.json().catch(() => ({}))) as CreateTranslationRequest;
  const targetLanguage = String(body.targetLanguage || "").trim().toLowerCase();
  if (!targetLanguage) {
    return validationErrorResponse("targetLanguage is required");
  }

  const result = await requestTranscriptionTranslation({
    job: access.job,
    targetLanguage,
    force: Boolean(body.force),
  });

  return successResponse(result);
}
