"use client";

import { AuthModal } from "@/components/tools/auth-modal";
import { AppUpgradeDialog } from "@/components/pricing/app-upgrade-dialog";
import {
  TranscriptionExportDialog,
  type TranscriptionExportOptions,
} from "@/components/transcriptions/transcription-export-dialog";
import { TranscriptionUpgradePlanDialog } from "@/components/transcriptions/transcription-upgrade-plan-dialog";
import { TranscriptionShareGateDialog } from "@/components/transcriptions/transcription-share-gate-dialog";
import { TranscriptionShareDialog } from "@/components/transcriptions/transcription-share-dialog";
import type { TranscriptionBasicUpgradePanelProps } from "@/components/transcriptions/transcription-basic-upgrade-panel";
import type { AuthModalDictionary } from "@markless/shared/src/i18n/types";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";

export type TranscriptionPageChromeDialogsProps = {
  exportDialogDict: TranscriptionsPageDictionary["exportDialog"];
  isExportDialogOpen: boolean;
  isExporting: boolean;
  onExportDialogOpenChange: (open: boolean) => void;
  onExport: (options: TranscriptionExportOptions) => Promise<void>;
  hasEditedSegments?: boolean;
  isUpgradeDialogOpen: boolean;
  onUpgradeDialogOpenChange: (open: boolean) => void;
  upgradePanelProps: Omit<
    TranscriptionBasicUpgradePanelProps,
    "entrySurface" | "headerVariant"
  >;
  isAppUpgradeDialogOpen: boolean;
  onAppUpgradeDialogOpenChange: (open: boolean) => void;
  appUpgradeEntrySurface: string;
  shareGateDict: TranscriptionsPageDictionary["shareGate"];
  isShareGateOpen: boolean;
  onShareGateOpenChange: (open: boolean) => void;
  onShareGateSignUp: () => void;
  shareDialogDict: TranscriptionsPageDictionary["shareDialog"];
  isShareDialogOpen: boolean;
  onShareDialogOpenChange: (open: boolean) => void;
  shareDialogEnabled: boolean;
  shareDialogUrl: string | null;
  isShareDialogLoading: boolean;
  isShareDialogMutating: boolean;
  onShareDialogEnable: () => void | Promise<void>;
  onShareDialogDisable: () => void | Promise<void>;
  onShareDialogCopy: () => void | Promise<void>;
  showAuthModal: boolean;
  onAuthModalOpenChange: (open: boolean) => void;
  authMode: "signin" | "signup";
  onAuthModeChange: (mode: "signin" | "signup") => void;
  locale: string;
  authModalDict: AuthModalDictionary;
};

export function TranscriptionPageChromeDialogs({
  exportDialogDict,
  isExportDialogOpen,
  isExporting,
  onExportDialogOpenChange,
  onExport,
  hasEditedSegments = false,
  isUpgradeDialogOpen,
  onUpgradeDialogOpenChange,
  upgradePanelProps,
  isAppUpgradeDialogOpen,
  onAppUpgradeDialogOpenChange,
  appUpgradeEntrySurface,
  shareGateDict,
  isShareGateOpen,
  onShareGateOpenChange,
  onShareGateSignUp,
  shareDialogDict,
  isShareDialogOpen,
  onShareDialogOpenChange,
  shareDialogEnabled,
  shareDialogUrl,
  isShareDialogLoading,
  isShareDialogMutating,
  onShareDialogEnable,
  onShareDialogDisable,
  onShareDialogCopy,
  showAuthModal,
  onAuthModalOpenChange,
  authMode,
  onAuthModeChange,
  locale,
  authModalDict,
}: TranscriptionPageChromeDialogsProps) {
  return (
    <>
      <TranscriptionExportDialog
        open={isExportDialogOpen}
        onOpenChange={onExportDialogOpenChange}
        dictionary={exportDialogDict}
        onExport={onExport}
        isExporting={isExporting}
        hasEditedSegments={hasEditedSegments}
      />

      <TranscriptionUpgradePlanDialog
        open={isUpgradeDialogOpen}
        onOpenChange={onUpgradeDialogOpenChange}
        {...upgradePanelProps}
      />

      <AppUpgradeDialog
        open={isAppUpgradeDialogOpen}
        onOpenChange={onAppUpgradeDialogOpenChange}
        entrySurface={appUpgradeEntrySurface}
        defaultTab="subscription"
      />

      <TranscriptionShareGateDialog
        open={isShareGateOpen}
        onOpenChange={onShareGateOpenChange}
        dict={shareGateDict}
        onSignUp={onShareGateSignUp}
      />

      <TranscriptionShareDialog
        open={isShareDialogOpen}
        onOpenChange={onShareDialogOpenChange}
        dict={shareDialogDict}
        enabled={shareDialogEnabled}
        shareUrl={shareDialogUrl}
        isLoading={isShareDialogLoading}
        isMutating={isShareDialogMutating}
        onEnable={onShareDialogEnable}
        onDisable={onShareDialogDisable}
        onCopy={onShareDialogCopy}
      />

      <AuthModal
        open={showAuthModal}
        onOpenChange={onAuthModalOpenChange}
        mode={authMode}
        onModeChange={onAuthModeChange}
        locale={locale}
        dictionary={authModalDict}
      />
    </>
  );
}
