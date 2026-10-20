import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "@markless/server/src/lib/admin/require-admin-session";
import { db } from "@markless/server/src/lib/db";
import { transcriptionFailureArchives } from "@markless/server/src/lib/db/schema/transcriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminSession(request.headers))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { resolved?: unknown } | null;
  if (typeof body?.resolved !== "boolean") {
    return NextResponse.json({ error: "resolved must be a boolean" }, { status: 400 });
  }

  const { id } = await params;
  const [archive] = await db
    .update(transcriptionFailureArchives)
    .set({ resolvedAt: body.resolved ? new Date() : null, updatedAt: new Date() })
    .where(eq(transcriptionFailureArchives.id, id))
    .returning({ id: transcriptionFailureArchives.id, resolvedAt: transcriptionFailureArchives.resolvedAt });

  if (!archive) {
    return NextResponse.json({ error: "Failure archive not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: archive });
}
