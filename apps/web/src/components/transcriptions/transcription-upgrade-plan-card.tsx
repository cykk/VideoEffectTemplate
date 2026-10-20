"use client";

import { forwardRef } from "react";
import { TranscriptionBasicUpgradePanel } from "@/components/transcriptions/transcription-basic-upgrade-panel";
import type { TranscriptionBasicUpgradePanelProps } from "@/components/transcriptions/transcription-basic-upgrade-panel";

type TranscriptionUpgradePlanCardProps = Omit<
  TranscriptionBasicUpgradePanelProps,
  "headerVariant" | "entrySurface" | "className"
>;

export const TranscriptionUpgradePlanCard = forwardRef<
  HTMLDivElement,
  TranscriptionUpgradePlanCardProps
>(function TranscriptionUpgradePlanCard(props, ref) {
  return (
    <div
      ref={ref}
      className="mx-auto w-full max-w-none scroll-mt-6 sm:max-w-2xl lg:max-w-3xl"
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <TranscriptionBasicUpgradePanel
          {...props}
          headerVariant="truncated"
          entrySurface="transcription_upgrade_card"
        />
      </div>
    </div>
  );
});
