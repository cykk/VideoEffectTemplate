import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "@markless/server/src/lib/admin/require-admin-session";
import { db } from "@markless/server/src/lib/db";
import {
  transcriptionFailureArchives,
  transcriptionJobs,
} from "@markless/server/src/lib/db/schema/transcriptions";
import { getPresignedDownloadUrl } from "@markless/server/src/lib/storage/r2-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminSession(request.headers))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }

  const { id } = await params;
  const archive = await db.query.transcriptionFailureArchives.findFirst({
    where: eq(transcriptionFailureArchives.id, id),
    columns: { transcriptionJobId: true },
  });
  if (!archive?.transcriptionJobId) {
    return NextResponse.json({ error: "Source media is unavailable" }, { status: 404 });
  }

  const job = await db.query.transcriptionJobs.findFirst({
    where: eq(transcriptionJobs.id, archive.transcriptionJobId),
    columns: {
      sourceR2Key: true,
      sourceFileName: true,
      sourceContentType: true,
    },
  });
  if (!job?.sourceR2Key) {
    return NextResponse.json({ error: "Source media is unavailable" }, { status: 404 });
  }

  try {
    const url = await getPresignedDownloadUrl(job.sourceR2Key, {
      filename: job.sourceFileName,
      contentType: job.sourceContentType,
      expiresIn: 300,
    });
    return NextResponse.redirect(url);
  } catch (error) {
    console.warn("[Admin Failure Archives] Failed to create source download URL", {
      archiveId: id,
      error,
    });
    return NextResponse.json({ error: "Source media is unavailable" }, { status: 404 });
  }
}
