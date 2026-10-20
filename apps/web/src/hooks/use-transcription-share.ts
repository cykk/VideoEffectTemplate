"use client";

import { useCallback, useRef, useState } from "react";
import { apiFetch } from "@markless/shared/src/lib/http/client";
import type { ApiErrorResponse, ApiSuccessResponse } from "@markless/shared/src/types/api/video";
import type { TranscriptionShareClientData } from "@markless/shared/src/types/transcriptions";
import { getAnonymousTranscriptionAccessToken } from "@/lib/transcriptions/client-storage";

type ShareResponse = {
  share: TranscriptionShareClientData;
};

type UseTranscriptionShareOptions = {
  publicId: string;
  dict: {
    toasts: {
      loadError: string;
      enableError: string;
      revokeError: string;
      copySuccess: string;
      copyError: string;
    };
  };
  onError?: (message: string) => void;
  onCopySuccess?: (message: string) => void;
};

function isApiSuccess<T>(
  payload: ApiSuccessResponse<T> | ApiErrorResponse | null
): payload is ApiSuccessResponse<T> {
  return Boolean(payload?.success);
}

export function useTranscriptionShare(options: UseTranscriptionShareOptions) {
  const { publicId, dict } = options;
  const onErrorRef = useRef(options.onError);
  const onCopySuccessRef = useRef(options.onCopySuccess);
  onErrorRef.current = options.onError;
  onCopySuccessRef.current = options.onCopySuccess;

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [share, setShare] = useState<TranscriptionShareClientData | null>(null);

  const getShareAuthHeaders = useCallback((): Record<string, string> | undefined => {
    const accessToken = getAnonymousTranscriptionAccessToken(publicId);
    return accessToken
      ? {
          "x-transcription-access-token": accessToken,
        }
      : undefined;
  }, [publicId]);

  const loadShare = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await apiFetch(`/api/transcriptions/${publicId}/share`, {
        method: "GET",
        cache: "no-store",
        headers: getShareAuthHeaders(),
      });
      const payload = (await response.json().catch(() => null)) as
        | ApiSuccessResponse<ShareResponse>
        | ApiErrorResponse
        | null;

      if (!response.ok || !isApiSuccess(payload)) {
        throw new Error(
          payload && !payload.success
            ? payload.error.message
            : dict.toasts.loadError
        );
      }

      setShare(payload.data.share);
      return payload.data.share;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : dict.toasts.loadError;
      onErrorRef.current?.(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [dict.toasts.loadError, getShareAuthHeaders, publicId]);

  const enableShare = useCallback(async () => {
    setIsMutating(true);

    try {
      const response = await apiFetch(`/api/transcriptions/${publicId}/share`, {
        method: "POST",
        headers: getShareAuthHeaders(),
      });
      const payload = (await response.json().catch(() => null)) as
        | ApiSuccessResponse<ShareResponse>
        | ApiErrorResponse
        | null;

      if (!response.ok || !isApiSuccess(payload)) {
        throw new Error(
          payload && !payload.success
            ? payload.error.message
            : dict.toasts.enableError
        );
      }

      setShare(payload.data.share);
      return payload.data.share;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : dict.toasts.enableError;
      onErrorRef.current?.(message);
      throw error;
    } finally {
      setIsMutating(false);
    }
  }, [dict.toasts.enableError, getShareAuthHeaders, publicId]);

  const revokeShare = useCallback(async () => {
    setIsMutating(true);

    try {
      const response = await apiFetch(`/api/transcriptions/${publicId}/share`, {
        method: "DELETE",
        headers: getShareAuthHeaders(),
      });
      const payload = (await response.json().catch(() => null)) as
        | ApiSuccessResponse<ShareResponse>
        | ApiErrorResponse
        | null;

      if (!response.ok || !isApiSuccess(payload)) {
        throw new Error(
          payload && !payload.success
            ? payload.error.message
            : dict.toasts.revokeError
        );
      }

      setShare(payload.data.share);
      return payload.data.share;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : dict.toasts.revokeError;
      onErrorRef.current?.(message);
      throw error;
    } finally {
      setIsMutating(false);
    }
  }, [dict.toasts.revokeError, getShareAuthHeaders, publicId]);

  const openDialog = useCallback(async () => {
    setIsOpen(true);
    await loadShare().catch(() => undefined);
  }, [loadShare]);

  const copyShareLink = useCallback(async () => {
    const value = share?.shareUrl?.trim();
    if (!value) {
      onErrorRef.current?.(dict.toasts.copyError);
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        throw new Error("Clipboard unavailable");
      }

      onCopySuccessRef.current?.(dict.toasts.copySuccess);
    } catch {
      onErrorRef.current?.(dict.toasts.copyError);
    }
  }, [dict.toasts.copyError, dict.toasts.copySuccess, share?.shareUrl]);

  return {
    isOpen,
    setIsOpen,
    isLoading,
    isMutating,
    share,
    openDialog,
    loadShare,
    enableShare,
    revokeShare,
    copyShareLink,
  };
}

