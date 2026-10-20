import type { TranscriptionAiArtifactClientData } from "@markless/shared/src/types/transcriptions";
import type { ArtifactTabStatus } from "@/components/transcriptions/transcription-mobile-workspace-tabs";

export function resolveArtifactTabStatus(
  artifact: TranscriptionAiArtifactClientData | null,
  isPending: boolean
): ArtifactTabStatus {
  if (isPending || artifact?.status === "processing") {
    return "processing";
  }

  if (artifact?.status === "completed") {
    return "ready";
  }

  return "idle";
}

