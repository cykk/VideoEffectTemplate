"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@markless/shared/src/lib/http/client";
import type { ApiErrorResponse, ApiSuccessResponse } from "@markless/shared/src/types/api/video";
import {
  clearPendingTranscriptionClaim,
  getPendingTranscriptionClaim,
  removeAnonymousTranscriptionAccessToken,
} from "@/lib/transcriptions/client-storage";
import { notifyTranscriptionClaimCompleted } from "@/lib/transcriptions/claim-events";
import { USER_BOOTSTRAP_QUERY_KEY } from "@/hooks/use-user-bootstrap";

type ClaimTranscriptionResponse = {
  claimed: boolean;
};

export function usePendingTranscriptionAutoClaim(authenticated: boolean | undefined) {
  const claimAttemptedRef = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authenticated) {
      claimAttemptedRef.current = false;
      return;
    }

    if (claimAttemptedRef.current) {
      return;
    }

    const pendingClaim = getPendingTranscriptionClaim();
    if (!pendingClaim) {
      return;
    }

    claimAttemptedRef.current = true;

    const claimTask = async () => {
      try {
        const response = await apiFetch(
          `/api/transcriptions/${pendingClaim.publicId}/claim`,
          {
            method: "POST",
            headers: {
              "x-transcription-access-token": pendingClaim.anonymousAccessToken,
            },
          }
        );

        const payload = (await response.json().catch(() => null)) as
          | ApiSuccessResponse<ClaimTranscriptionResponse>
          | ApiErrorResponse
          | null;

        if (!response.ok || !payload?.success) {
          throw new Error(
            payload && !payload.success
              ? payload.error.message
              : "Failed to claim transcription"
          );
        }

        removeAnonymousTranscriptionAccessToken(pendingClaim.publicId);
        clearPendingTranscriptionClaim();
        notifyTranscriptionClaimCompleted();
        await queryClient.invalidateQueries({ queryKey: USER_BOOTSTRAP_QUERY_KEY });
      } catch (error) {
        claimAttemptedRef.current = false;
        if (process.env.NODE_ENV === "development") {
          console.warn("[Transcriptions] Pending claim auto-bind failed", error);
        }
      }
    };

    void claimTask();
  }, [authenticated, queryClient]);
}
