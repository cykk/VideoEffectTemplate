import { NextRequest, NextResponse } from "next/server";
import { captureFirstTouch, FIRST_TOUCH_COOKIE } from "@markless/server/src/lib/attribution/first-touch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  if (request.cookies.has(FIRST_TOUCH_COOKIE)) return NextResponse.json({ captured: false });
  const touch = captureFirstTouch(request);
  const landingPath = request.nextUrl.searchParams.get("_landing_path");
  if (landingPath?.startsWith("/")) touch.firstLandingPath = landingPath.slice(0, 500);
  const response = NextResponse.json({ captured: true });
  response.cookies.set(FIRST_TOUCH_COOKIE, JSON.stringify(touch), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
