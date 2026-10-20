import { NextRequest } from "next/server";
import { auth } from "@markless/server/src/lib/auth/server";
import {
    errorResponse,
    successResponse,
    validationErrorResponse,
} from "@markless/shared/src/lib/api/response";
import {
    generateTranscriptionSourceKey,
    getPresignedUploadUrl,
    R2ConfigurationError,
    R2OperationError,
    resolveR2ObjectUrl,
} from "@markless/server/src/lib/storage/r2-storage";
import {
    createAnonymousTranscriptionSessionId,
    getAnonymousTranscriptionSessionId,
    setAnonymousTranscriptionSessionCookie,
} from "@markless/shared/src/lib/transcriptions/anonymous-session";
import {
    resolveSupportedTranscriptionUploadContentType,
} from "@markless/shared/src/lib/transcriptions/media-formats";
import { getTranscriptionUploadMaxFileBytes } from "@markless/shared/src/lib/transcriptions/upload-limits";
import { recordTranscriptionUploadFailure } from "@markless/server/src/lib/transcriptions/upload-failure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadKind = "video" | "audio";

function isValidUploadKind(value: string): value is UploadKind {
    return value === "audio" || value === "video";
}

function resolveExtension(fileName: string, contentType: string): string {
    const normalizedName = fileName.trim().toLowerCase();
    const fromName = normalizedName.includes(".") ? normalizedName.split(".").pop() : "";

    if (fromName) {
        return fromName;
    }

    const fallbackMap: Record<string, string> = {
        "application/pdf": "pdf",
        "text/plain": "txt",
        "text/csv": "csv",
        "application/json": "json",
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/webp": "webp",
        "image/gif": "gif",
        "video/mp4": "mp4",
        "video/quicktime": "mov",
        "video/webm": "webm",
    };

    return fallbackMap[contentType] ?? "bin";
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id ?? null;
  const requestId = req.headers.get("x-request-id");
  const anonymousSessionId = userId
    ? null
    : getAnonymousTranscriptionSessionId(req) || createAnonymousTranscriptionSessionId();

    let body: {
        kind?: string;
        fileName?: string;
        fileSize?: number;
        contentType?: string;
    };
    try {
    body = await req.json();
  } catch {
    await recordTranscriptionUploadFailure({ requestId, userId, anonymousSessionId, failureStage: "validation", errorCode: "INVALID_PARAMS", errorMessage: "Invalid JSON body" });
    return validationErrorResponse("Invalid JSON body");
    }

    const kind = String(body.kind || "").trim();
    const fileName = String(body.fileName || "").trim();
    const requestedContentType = String(body.contentType || "").trim();
    const fileSize = Number(body.fileSize || 0);

    if (!isValidUploadKind(kind)) {
        await recordTranscriptionUploadFailure({ requestId, userId, anonymousSessionId, sourceType: kind, fileName, contentType: requestedContentType, fileSize, failureStage: "validation", errorCode: "INVALID_PARAMS", errorMessage: "kind is invalid" });
        return validationErrorResponse("kind is invalid");
    }

    const isAnonymous = !userId;

    if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0) {
        await recordTranscriptionUploadFailure({ requestId, userId, anonymousSessionId, sourceType: kind, fileName, contentType: requestedContentType, fileSize, failureStage: "validation", errorCode: "INVALID_PARAMS", errorMessage: "fileName, contentType and fileSize are required" });
        return validationErrorResponse("fileName, contentType and fileSize are required");
    }

    const contentType = resolveSupportedTranscriptionUploadContentType({
        sourceType: kind,
        fileName,
        contentType: requestedContentType,
    });
    if (!contentType) {
        await recordTranscriptionUploadFailure({ requestId, userId, anonymousSessionId, sourceType: kind, fileName, contentType: requestedContentType, fileSize, failureStage: "file_validation", errorCode: "UNSUPPORTED_FILE_TYPE", errorMessage: "Unsupported file type" });
        return validationErrorResponse("Unsupported file type");
    }

    const maxFileSizeBytes = getTranscriptionUploadMaxFileBytes({
        accessMode: userId ? "authenticated" : "anonymous",
        sourceType: kind,
    });
    if (fileSize > maxFileSizeBytes) {
        await recordTranscriptionUploadFailure({ requestId, userId, anonymousSessionId, sourceType: kind, fileName, contentType, fileSize, failureStage: "file_validation", errorCode: "FILE_TOO_LARGE", errorMessage: "Uploaded file exceeds the allowed size" });
        return errorResponse(
            "UPLOAD_FILE_TOO_LARGE",
            "Uploaded file exceeds the allowed size",
            413,
            { maxFileSizeBytes }
        );
    }

    const extension = resolveExtension(fileName, contentType);
    const ownerId = userId ? `user_${userId}` : `anon_${anonymousSessionId}`;
    const key = generateTranscriptionSourceKey(ownerId, extension);

    let uploadUrl: string;
    let objectUrl: string;
    try {
        uploadUrl = await getPresignedUploadUrl(key, contentType);
        objectUrl = await resolveR2ObjectUrl(key);
    } catch (error) {
        if (error instanceof R2ConfigurationError || error instanceof R2OperationError) {
            const message = error instanceof Error ? error.message : "Failed to prepare R2 upload";
            await recordTranscriptionUploadFailure({ requestId, userId, anonymousSessionId, sourceType: kind, fileName, contentType, fileSize, failureStage: "upload_url", errorCode: "UPLOAD_URL_FAILED", errorMessage: message });
            return errorResponse("INTERNAL_ERROR", message, 500);
        }
        await recordTranscriptionUploadFailure({ requestId, userId, anonymousSessionId, sourceType: kind, fileName, contentType, fileSize, failureStage: "upload_url", errorCode: "UPLOAD_URL_FAILED", errorMessage: "Failed to prepare R2 upload" });
        return errorResponse("INTERNAL_ERROR", "Failed to prepare R2 upload", 500);
    }

    const response = successResponse({
        key,
        uploadUrl,
        objectUrl,
        method: "PUT",
        headers: {
            "Content-Type": contentType,
        },
    });

    if (isAnonymous && anonymousSessionId) {
        setAnonymousTranscriptionSessionCookie(response, anonymousSessionId);
    }

    return response;
}
