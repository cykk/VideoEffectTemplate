import { NextResponse } from "next/server";
import { requireAdminSession } from "@markless/server/src/lib/admin/require-admin-session";
import { resolveAdminTranscriptionSourceDownload } from "@markless/server/src/lib/transcriptions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    publicId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  if (!(await requireAdminSession(request.headers))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }

  const { publicId } = await context.params;

  try {
    const download = await resolveAdminTranscriptionSourceDownload(publicId);
    if (!download) {
      return NextResponse.json({ error: "Source media is unavailable" }, { status: 404 });
    }

    return NextResponse.redirect(download.url);
  } catch (error) {
    console.warn("[Admin Transcriptions] Failed to create source download URL", {
      publicId,
      error,
    });
    return NextResponse.json({ error: "Source media is unavailable" }, { status: 404 });
  }
}
