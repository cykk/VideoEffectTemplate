"use client";

import { TranscriptionHeroUpload } from "@/components/marketing/transcription-hero-upload";

export function DashboardTranscriptionUpload({
  onTranscriptionCreated,
}: {
  onTranscriptionCreated?: (publicId: string) => void | Promise<void>;
}) {
  return (
    <TranscriptionHeroUpload
      variant="dashboard"
      showFooter={false}
      enableLinkTab={false}
      onTranscriptionCreated={onTranscriptionCreated}
    />
  );
}
