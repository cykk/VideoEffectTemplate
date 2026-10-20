import { NextRequest } from "next/server";
import { auth } from "@markless/server/src/lib/auth/server";
import {
  errorResponse,
  internalErrorResponse,
  successResponse,
  unauthorizedResponse,
} from "@markless/shared/src/lib/api/response";
import { authorizeTranscriptionRead } from "@markless/server/src/lib/transcriptions/access";
import {
  deleteOwnerTranscriptionJob,
  renameTranscriptionDisplayTitle,
  serializeTranscriptionReadResponse,
} from "@markless/server/src/lib/transcriptions/service";
import { createTranscriptionStreamToken } from "@markless/shared/src/lib/transcriptions/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function requireUserId(request: NextRequest): Promise<string | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

function buildStreamTokenOrNull(
  publicId: string,
  options?: {
    anonymousSessionId?: string | null;
  }
): string | null {
  try {
    return createTranscriptionStreamToken(publicId, {
      anonymousSessionId: options?.anonymousSessionId ?? null,
    });
  } catch (error) {
    console.error("[Transcriptions] Failed to create stream token", error);
    return null;
  }
}

type RenameTranscriptionRequest = {
  displayTitle?: string | null;
};

function isAccessDenied(
  access: Awaited<ReturnType<typeof authorizeTranscriptionRead>>
): access is { ok: false; reason: "not_found" | "forbidden" } {
  return !access.ok;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const access = await authorizeTranscriptionRead(request, id);

  if (isAccessDenied(access)) {
    return errorResponse(
      access.reason === "not_found" ? "INVALID_PARAMS" : "FORBIDDEN",
      access.reason === "not_found" ? "Transcription not found" : "Access denied",
      access.reason === "not_found" ? 404 : 403
    );
  }

  return successResponse(
    await serializeTranscriptionReadResponse(
      access.job,
      buildStreamTokenOrNull(access.job.publicId, {
        anonymousSessionId:
          access.mode === "anonymous" ? access.job.anonymousSessionId : null,
      })
    )
  );
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const access = await authorizeTranscriptionRead(request, id);

  if (isAccessDenied(access)) {
    return errorResponse(
      access.reason === "not_found" ? "INVALID_PARAMS" : "FORBIDDEN",
      access.reason === "not_found" ? "Transcription not found" : "Access denied",
      access.reason === "not_found" ? 404 : 403
    );
  }

  if (access.mode === "admin") {
    return errorResponse("FORBIDDEN", "Access denied", 403);
  }

  const body = (await request.json().catch(() => ({}))) as RenameTranscriptionRequest;
  if (typeof body.displayTitle !== "string") {
    return errorResponse("INVALID_PARAMS", "Display title is required", 400);
  }

  try {
    const job = await renameTranscriptionDisplayTitle(id, body.displayTitle);
    if (!job) {
      return errorResponse("INVALID_PARAMS", "Transcription not found", 404);
    }

    return successResponse({
      publicId: job.publicId,
      displayTitle: job.sourceDisplayTitle ?? body.displayTitle.trim(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to rename transcription";

    if (message === "Display title cannot be empty") {
      return errorResponse("INVALID_PARAMS", message, 400);
    }

    if (message === "Display title is too long") {
      return errorResponse("INVALID_PARAMS", message, 400);
    }

    return errorResponse("INTERNAL_ERROR", message, 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const userId = await requireUserId(request);
  if (!userId) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;

  try {
    const deleted = await deleteOwnerTranscriptionJob({
      publicId: id,
      userId,
    });

    if (!deleted) {
      return errorResponse("INVALID_PARAMS", "Transcription not found", 404);
    }

    return successResponse({ deleted: true });
  } catch (error) {
    console.error("[Transcriptions] Failed to delete transcription", {
      publicId: id,
      userId,
      error,
    });
    return internalErrorResponse("Failed to delete transcription");
  }
}
