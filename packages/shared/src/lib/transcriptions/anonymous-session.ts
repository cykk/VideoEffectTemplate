import { randomUUID } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

export const ANONYMOUS_TRANSCRIPTION_SESSION_COOKIE = "tv_anon_transcription_session";

function buildCookieExpires(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function getAnonymousTranscriptionSessionId(
  request: Pick<NextRequest, "cookies">
): string | null {
  return request.cookies.get(ANONYMOUS_TRANSCRIPTION_SESSION_COOKIE)?.value ?? null;
}

export function createAnonymousTranscriptionSessionId(): string {
  return randomUUID();
}

export function setAnonymousTranscriptionSessionCookie(
  response: NextResponse,
  sessionId: string
): void {
  response.cookies.set(ANONYMOUS_TRANSCRIPTION_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: buildCookieExpires(30),
  });
}
