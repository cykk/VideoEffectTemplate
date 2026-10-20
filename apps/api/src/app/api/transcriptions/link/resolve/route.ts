import { NextRequest } from "next/server";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@markless/shared/src/lib/api/response";
import {
  resolveLinkPreview,
  validateIncomingLink,
} from "@markless/shared/src/lib/transcriptions/link-media";
import { createTranscriptionLinkPreviewToken } from "@markless/shared/src/lib/transcriptions/tokens";
import { API_ERROR_CODES } from "@markless/shared/src/types/api/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResolveLinkRequest = {
  url?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ResolveLinkRequest;
  const url = String(body.url || "").trim();

  if (!url) {
    return validationErrorResponse("url is required");
  }

  try {
    const normalizedUrl = validateIncomingLink(url);
    const media = await resolveLinkPreview(normalizedUrl);
    return successResponse({
      canonicalUrl: media.canonicalUrl,
      title: media.title,
      durationMs: media.durationMs,
      thumbnailUrl: media.thumbnailUrl,
      sourceType: media.sourceType,
      status: media.status,
      reason: media.reason ?? null,
      message: media.message ?? null,
      previewToken: createTranscriptionLinkPreviewToken({
        requestUrl: normalizedUrl,
        canonicalUrl: media.canonicalUrl,
        title: media.title,
        durationMs: media.durationMs,
        sourceType: media.sourceType,
        status: media.status,
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve media link";
    console.error("[Transcriptions][Link Resolve] Failed:", error);
    const isInputError =
      message === "Link is required" ||
      message === "Please enter a valid media link" ||
      message.includes("Link is invalid") ||
      message.includes("Link must use http or https") ||
      message.includes("Link host is not allowed");
    const isPreviewTimeoutError = message.includes("preview resolve timed out");
    const isInstagramPublicScopeError =
      message.includes("cookies-from-browser") ||
      message.includes("use --cookies") ||
      message.toLowerCase().includes("instagram sent an empty media response");

    if (isPreviewTimeoutError) {
      return errorResponse(
        API_ERROR_CODES.LINK_PREVIEW_TIMEOUT,
        "This video is taking longer than expected to inspect. Please try again.",
        504
      );
    }

    if (isInstagramPublicScopeError) {
      return errorResponse(
        API_ERROR_CODES.INSTAGRAM_MEDIA_UNAVAILABLE,
        "This Instagram post can't be processed from a public link right now. Upload the video file to continue.",
        422
      );
    }

    return errorResponse(
      isInputError ? API_ERROR_CODES.INVALID_PARAMS : API_ERROR_CODES.INTERNAL_ERROR,
      message,
      isInputError ? 400 : 500
    );
  }
}
