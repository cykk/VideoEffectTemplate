import { NextRequest } from "next/server";
import { auth } from "@markless/server/src/lib/auth/server";
import {
  errorResponse,
  successResponse,
  unauthorizedResponse,
} from "@markless/shared/src/lib/api/response";
import { authorizeTranscriptionRead } from "@markless/server/src/lib/transcriptions/access";
import { claimAnonymousTranscriptionJob } from "@markless/server/src/lib/transcriptions/service";
import {
  enableOwnerTranscriptionShare,
  getOwnerTranscriptionShare,
  revokeOwnerTranscriptionShare,
} from "@markless/server/src/lib/transcriptions/shares";

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

async function tryClaimAnonymousTranscriptionForShare(
  request: NextRequest,
  publicId: string,
  userId: string
): Promise<boolean> {
  const access = await authorizeTranscriptionRead(request, publicId);

  if (!access.ok || access.mode !== "anonymous" || !access.job.anonymousSessionId) {
    return false;
  }

  const claimedJob = await claimAnonymousTranscriptionJob({
    publicId: access.job.publicId,
    userId,
    anonymousSessionId: access.job.anonymousSessionId,
  });

  return Boolean(claimedJob);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const userId = await requireUserId(request);
  if (!userId) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  const share = await getOwnerTranscriptionShare({
    publicId: id,
    userId,
  });

  if (share) {
    return successResponse({ share });
  }

  const claimed = await tryClaimAnonymousTranscriptionForShare(request, id, userId);
  if (!claimed) {
    return errorResponse("INVALID_PARAMS", "Transcription not found", 404);
  }

  const claimedShare = await getOwnerTranscriptionShare({
    publicId: id,
    userId,
  });

  if (!claimedShare) {
    return errorResponse("INVALID_PARAMS", "Transcription not found", 404);
  }

  return successResponse({ share: claimedShare });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const userId = await requireUserId(request);
  if (!userId) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  const share = await enableOwnerTranscriptionShare({
    publicId: id,
    userId,
  });

  if (share) {
    return successResponse({ share });
  }

  const claimed = await tryClaimAnonymousTranscriptionForShare(request, id, userId);
  if (!claimed) {
    return errorResponse("INVALID_PARAMS", "Transcription not found", 404);
  }

  const claimedShare = await enableOwnerTranscriptionShare({
    publicId: id,
    userId,
  });

  if (!claimedShare) {
    return errorResponse("INVALID_PARAMS", "Transcription not found", 404);
  }

  return successResponse({ share: claimedShare });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const userId = await requireUserId(request);
  if (!userId) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  const share = await revokeOwnerTranscriptionShare({
    publicId: id,
    userId,
  });

  if (share) {
    return successResponse({ share });
  }

  const claimed = await tryClaimAnonymousTranscriptionForShare(request, id, userId);
  if (!claimed) {
    return errorResponse("INVALID_PARAMS", "Transcription not found", 404);
  }

  const claimedShare = await revokeOwnerTranscriptionShare({
    publicId: id,
    userId,
  });

  if (!claimedShare) {
    return errorResponse("INVALID_PARAMS", "Transcription not found", 404);
  }

  return successResponse({ share: claimedShare });
}
