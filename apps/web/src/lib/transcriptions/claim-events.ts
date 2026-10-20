export const TRANSCRIPTION_CLAIM_COMPLETED_EVENT =
  "transvio:transcription-claim-completed";

export function notifyTranscriptionClaimCompleted(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(TRANSCRIPTION_CLAIM_COMPLETED_EVENT));
}
