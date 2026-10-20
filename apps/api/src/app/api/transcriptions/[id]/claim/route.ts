import { NextRequest } from "next/server";
import {
  errorResponse,
  successResponse,
} from "@markless/shared/src/lib/api/response";
import { auth } from "@markless/server/src/lib/auth/server";
import { authorizeTranscriptionRead } from "@markless/server/src/lib/transcriptions/access";
import {
  claimAnonymousTranscriptionJob,
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
    console.error("[Transcriptions] Failed to create claim stream token", error);
    return null;
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id ?? null;

  if (!userId) {
    return errorResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  const { id } = await context.params;
  const access = await authorizeTranscriptionRead(request, id);

  if ("reason" in access) {
    return errorResponse(
      access.reason === "not_found" ? "INVALID_PARAMS" : "FORBIDDEN",
      access.reason === "not_found" ? "Transcription not found" : "Access denied",
      access.reason === "not_found" ? 404 : 403
    );
  }

  if (access.mode !== "anonymous" || !access.job.anonymousSessionId) {
    return successResponse({
      claimed: false,
      task: await serializeTranscriptionReadResponse(
        access.job,
        buildStreamTokenOrNull(access.job.publicId)
      ),
    });
  }

  const claimedJob = await claimAnonymousTranscriptionJob({
    publicId: access.job.publicId,
    userId,
    anonymousSessionId: access.job.anonymousSessionId,
  });

  if (!claimedJob) {
    return errorResponse("FORBIDDEN", "Unable to claim transcription", 403);
  }

  return successResponse({
    claimed: true,
    task: await serializeTranscriptionReadResponse(
      claimedJob,
      buildStreamTokenOrNull(claimedJob.publicId)
    ),
  });
}
