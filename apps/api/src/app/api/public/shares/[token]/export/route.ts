import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@markless/shared/src/lib/api/response";
import { buildPublicTranscriptionShareExportFile } from "@markless/server/src/lib/transcriptions/shares";
import type { TranscriptionExportFormat } from "@markless/server/src/lib/transcriptions/export-service";
import {
  normalizeSubtitleLayoutOptions,
  type SubtitleLayoutOptions,
} from "@markless/server/src/lib/transcriptions/subtitle-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

type ExportRequestBody = {
  format?: TranscriptionExportFormat;
  showSpeakerNames?: boolean;
  showTimestamps?: boolean;
  subtitleLayout?: Partial<SubtitleLayoutOptions>;
};

function isValidFormat(value: string): value is TranscriptionExportFormat {
  return value === "txt" || value === "csv" || value === "pdf" || value === "docx" || value === "srt" || value === "vtt";
}

function buildDownloadContentDisposition(fileName: string): string {
  const asciiFallback = fileName
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\]/g, "")
    .trim() || "transcript";

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const body = (await request.json().catch(() => ({}))) as ExportRequestBody;
  const format = String(body.format || "").trim();

  if (!isValidFormat(format)) {
    return errorResponse("INVALID_PARAMS", "Invalid export format", 400);
  }

  let subtitleLayout: SubtitleLayoutOptions | undefined;
  if (format === "srt" || format === "vtt") {
    try {
      subtitleLayout = normalizeSubtitleLayoutOptions(body.subtitleLayout);
    } catch (error) {
      return errorResponse(
        "INVALID_PARAMS",
        error instanceof Error ? error.message : "Invalid subtitle layout options",
        400
      );
    }
  }

  try {
    const file = await buildPublicTranscriptionShareExportFile(token, {
      format,
      showSpeakerNames: Boolean(body.showSpeakerNames),
      showTimestamps: Boolean(body.showTimestamps),
      subtitleLayout,
    });

    if (!file) {
      return errorResponse("INVALID_PARAMS", "Shared transcription not found", 404);
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": buildDownloadContentDisposition(file.fileName),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Failed to export transcription",
      500
    );
  }
}
