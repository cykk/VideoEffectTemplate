"use client";

import { useEffect } from "react";
import { TRANSCRIPTION_CLAIM_COMPLETED_EVENT } from "@/lib/transcriptions/claim-events";

export function useReloadOnTranscriptionClaimCompleted(reload: () => void | Promise<void>) {
  useEffect(() => {
    const handleClaimCompleted = () => {
      void reload();
    };

    window.addEventListener(TRANSCRIPTION_CLAIM_COMPLETED_EVENT, handleClaimCompleted);

    return () => {
      window.removeEventListener(TRANSCRIPTION_CLAIM_COMPLETED_EVENT, handleClaimCompleted);
    };
  }, [reload]);
}
