import type { NextRequest } from "next/server";
import { auth } from "@markless/server/src/lib/auth/server";
import { isAdminUser } from "@markless/server/src/lib/admin/is-admin-user";
import {
  getTranscriptionJobByPublicId,
  isTranscriptionJobExpired,
} from "@markless/server/src/lib/transcriptions/service";
import {
  verifyAnonymousTranscriptionAccessToken,
  verifyTranscriptionStreamToken,
} from "@markless/shared/src/lib/transcriptions/tokens";

type ResolvedTranscriptionJob = Awaited<
  ReturnType<typeof getTranscriptionJobByPublicId>
>;

export type TranscriptionAccessResult =
  | { ok: true; job: NonNullable<ResolvedTranscriptionJob>; mode: "session" | "anonymous" | "admin" }
  | { ok: false; reason: "not_found" | "forbidden" };

async function resolveSessionUserId(request: NextRequest): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    return session?.user?.id ?? null;
  } catch (error) {
    console.error("[Transcriptions] Failed to resolve auth session", error);
    return null;
  }
}

function readAccessTokenFromRequest(request: NextRequest): string | null {
  const headerToken = request.headers.get("x-transcription-access-token")?.trim();
  if (headerToken) {
    return headerToken;
  }

  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export async function authorizeTranscriptionRead(
  request: NextRequest,
  publicId: string
): Promise<TranscriptionAccessResult> {
  const job = await getTranscriptionJobByPublicId(publicId);
  if (!job) {
    return { ok: false, reason: "not_found" };
  }

  const sessionUserId = await resolveSessionUserId(request);
  const adminSession = sessionUserId ? await isAdminUser(sessionUserId) : false;

  if (!adminSession && isTranscriptionJobExpired(job)) {
    return { ok: false, reason: "not_found" };
  }

  const token = readAccessTokenFromRequest(request);
  const verification = verifyAnonymousTranscriptionAccessToken(token);
  if (
    verification.valid &&
    verification.payload?.publicId === publicId &&
    verification.payload.anonymousSessionId &&
    job.anonymousSessionId === verification.payload.anonymousSessionId
  ) {
    return {
      ok: true,
      job,
      mode: "anonymous",
    };
  }

  if (sessionUserId && (job.userId === sessionUserId || adminSession)) {
    return {
      ok: true,
      job,
      mode: adminSession && job.userId !== sessionUserId ? "admin" : "session",
    };
  }

  return { ok: false, reason: "forbidden" };
}

export async function authorizeTranscriptionStream(
  request: NextRequest,
  publicId: string
): Promise<TranscriptionAccessResult> {
  const job = await getTranscriptionJobByPublicId(publicId);
  if (!job) {
    return { ok: false, reason: "not_found" };
  }

  const sessionUserId = await resolveSessionUserId(request);
  const adminSession = sessionUserId ? await isAdminUser(sessionUserId) : false;

  if (!adminSession && isTranscriptionJobExpired(job)) {
    return { ok: false, reason: "not_found" };
  }

  const token = request.nextUrl.searchParams.get("token")?.trim() || null;
  const verification = verifyTranscriptionStreamToken(token);
  if (verification.valid && verification.payload?.publicId === publicId) {
    if (
      verification.payload.anonymousSessionId &&
      job.anonymousSessionId === verification.payload.anonymousSessionId
    ) {
      return {
        ok: true,
        job,
        mode: "anonymous",
      };
    }

    if (!verification.payload.anonymousSessionId) {
      return {
        ok: true,
        job,
        mode: "session",
      };
    }
  }

  if (sessionUserId && (job.userId === sessionUserId || adminSession)) {
    return {
      ok: true,
      job,
      mode: adminSession && job.userId !== sessionUserId ? "admin" : "session",
    };
  }

  return { ok: false, reason: "forbidden" };
}
