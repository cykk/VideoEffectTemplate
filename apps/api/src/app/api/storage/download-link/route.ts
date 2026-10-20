import { NextRequest } from "next/server";
import { successResponse, validationErrorResponse } from "@markless/shared/src/lib/api/response";
import {
    getPresignedDownloadUrl,
    tryExtractR2KeyFromUrl,
} from "@markless/server/src/lib/storage/r2-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DownloadLinkMode = "presigned" | "proxy";
type DownloadMediaType = "image" | "video";

const DOWNLOAD_EXPIRES_SECONDS: Record<DownloadMediaType, number> = {
    image: 600,
    video: 900,
};

function sanitizeFilename(value: string | null): string {
    const fallback = "download.bin";
    const normalized = (value || "").trim();
    if (!normalized) {
        return fallback;
    }

    const cleaned = normalized
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return cleaned || fallback;
}

function buildProxyDownloadPath(rawUrl: string, filename: string): string {
    const params = new URLSearchParams({
        url: rawUrl,
        filename,
    });

    return `/api/storage/download?${params.toString()}`;
}

function parseMediaType(value: string | null): DownloadMediaType {
    return value === "video" ? "video" : "image";
}

export async function GET(request: NextRequest) {
    const rawUrl = request.nextUrl.searchParams.get("url");
    if (!rawUrl) {
        return validationErrorResponse("url is required");
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(rawUrl);
    } catch {
        return validationErrorResponse("url is invalid");
    }

    if (parsedUrl.protocol !== "https:") {
        return validationErrorResponse("url must use https");
    }

    const mediaType = parseMediaType(request.nextUrl.searchParams.get("mediaType"));
    const filename = sanitizeFilename(request.nextUrl.searchParams.get("filename"));
    const proxyPath = buildProxyDownloadPath(parsedUrl.toString(), filename);
    const objectKey = tryExtractR2KeyFromUrl(parsedUrl.toString());

    if (!objectKey) {
        return successResponse({
            mode: "proxy" as DownloadLinkMode,
            url: proxyPath,
            filename,
        });
    }

    try {
        const presignedUrl = await getPresignedDownloadUrl(objectKey, {
            filename,
            expiresIn: DOWNLOAD_EXPIRES_SECONDS[mediaType],
        });

        return successResponse({
            mode: "presigned" as DownloadLinkMode,
            url: presignedUrl,
            filename,
            expiresIn: DOWNLOAD_EXPIRES_SECONDS[mediaType],
        });
    } catch (error) {
        console.warn("[Download Link] Failed to generate presigned URL, falling back to proxy:", error);

        return successResponse({
            mode: "proxy" as DownloadLinkMode,
            url: proxyPath,
            filename,
        });
    }
}
