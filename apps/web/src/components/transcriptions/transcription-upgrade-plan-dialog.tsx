"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@markless/shared/src/lib/utils";
import {
  TranscriptionBasicUpgradePanel,
  type TranscriptionBasicUpgradePanelProps,
} from "@/components/transcriptions/transcription-basic-upgrade-panel";

interface TranscriptionUpgradePlanDialogProps
  extends Omit<TranscriptionBasicUpgradePanelProps, "entrySurface" | "headerVariant"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TranscriptionUpgradePlanDialog({
  open,
  onOpenChange,
  ...panelProps
}: TranscriptionUpgradePlanDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-xl gap-0 overflow-y-auto p-0 sm:max-w-xl",
          "[&>[data-slot=dialog-close]]:top-3 [&>[data-slot=dialog-close]]:right-3",
          "[&>[data-slot=dialog-close]]:z-10 [&>[data-slot=dialog-close]]:p-1.5"
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{panelProps.dict.plan.title}</DialogTitle>
          <DialogDescription>{panelProps.dict.dialog.closeAria}</DialogDescription>
        </DialogHeader>
        <TranscriptionBasicUpgradePanel
          {...panelProps}
          headerVariant="planOnly"
          entrySurface="transcription_upgrade_dialog"
          featuresLayout="single"
          className="space-y-5 rounded-none border-0 pb-5 pl-5 pr-11 pt-10 shadow-none sm:space-y-6 sm:pb-6 sm:pl-6 sm:pr-12 sm:pt-10"
        />
      </DialogContent>
    </Dialog>
  );
}
