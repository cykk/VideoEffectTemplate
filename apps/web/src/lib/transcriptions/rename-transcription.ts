import { apiFetch } from "@markless/shared/src/lib/http/client";
import type { ApiErrorResponse, ApiSuccessResponse } from "@markless/shared/src/types/api/video";

export type RenameTranscriptionResponse = {
  publicId: string;
  displayTitle: string;
};

function isApiSuccess<T>(
  payload: ApiSuccessResponse<T> | ApiErrorResponse | null
): payload is ApiSuccessResponse<T> {
  return Boolean(payload?.success);
}

export async function renameTranscriptionDisplayTitleRequest(input: {
  publicId: string;
  displayTitle: string;
  headers?: Record<string, string>;
  fallbackErrorMessage: string;
}): Promise<RenameTranscriptionResponse> {
  const response = await apiFetch(`/api/transcriptions/${input.publicId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(input.headers ?? {}),
    },
    body: JSON.stringify({
      displayTitle: input.displayTitle,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | ApiSuccessResponse<RenameTranscriptionResponse>
    | ApiErrorResponse
    | null;

  if (!response.ok || !isApiSuccess(payload)) {
    throw new Error(
      payload && !payload.success
        ? payload.error.message
        : input.fallbackErrorMessage
    );
  }

  return payload.data;
}

