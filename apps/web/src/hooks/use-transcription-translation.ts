"use client";

import { useCallback, useState } from "react";
import type { TranslationTargetLanguageId } from "@markless/shared/src/i18n/data/translation-target-languages";
import { apiFetch } from "@markless/shared/src/lib/http/client";
import type { ApiErrorResponse, ApiSuccessResponse } from "@markless/shared/src/types/api/video";
import type { TranscriptionTranslationClientData } from "@markless/shared/src/types/transcriptions";

const DEFAULT_TARGET_LANGUAGE: TranslationTargetLanguageId = "en";

type RequestTranslationResponse = {
  translation: TranscriptionTranslationClientData;
  queued: boolean;
};

type StartTranslationOptions = {
  force?: boolean;
};

function isApiSuccess<T>(
  payload: ApiSuccessResponse<T> | ApiErrorResponse | null
): payload is ApiSuccessResponse<T> {
  return Boolean(payload?.success);
}

export function useTranscriptionTranslation(options: {
  publicId: string;
  getAuthHeaders: () => Record<string, string> | undefined;
  onTranslationRequested?: (translation: TranscriptionTranslationClientData) => void;
  onTranslationError?: (message: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [targetLanguage, setTargetLanguage] =
    useState<TranslationTargetLanguageId>(DEFAULT_TARGET_LANGUAGE);
  const [isTranslating, setIsTranslating] = useState(false);

  const openPanel = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const togglePanel = useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  const handleStartTranslation = useCallback(
    async (startOptions: StartTranslationOptions = {}) => {
      if (isTranslating) {
        return;
      }

      setIsTranslating(true);

      try {
        const response = await apiFetch(`/api/transcriptions/${options.publicId}/translations`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(options.getAuthHeaders() ?? {}),
          },
          body: JSON.stringify({
            targetLanguage,
            force: startOptions.force ?? false,
          }),
        });

        const payload = (await response.json().catch(() => null)) as
          | ApiSuccessResponse<RequestTranslationResponse>
          | ApiErrorResponse
          | null;

        if (!response.ok || !isApiSuccess(payload)) {
          const message =
            payload && !payload.success
              ? payload.error.message
              : "Failed to start translation";
          options.onTranslationError?.(message);
          throw new Error(message);
        }

        options.onTranslationRequested?.(payload.data.translation);
      } catch (error) {
        if (error instanceof Error) {
          options.onTranslationError?.(error.message);
        }
        throw error;
      } finally {
        setIsTranslating(false);
      }
    },
    [isTranslating, options, targetLanguage]
  );

  return {
    isOpen,
    setIsOpen,
    targetLanguage,
    setTargetLanguage,
    isTranslating,
    openPanel,
    closePanel,
    togglePanel,
    handleStartTranslation,
  };
}

