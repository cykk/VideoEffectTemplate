"use client";

import { useCallback, useMemo, useState } from "react";
import type { TranscriptionPageChromeDialogsProps } from "@/components/transcriptions/transcription-page-chrome-dialogs";
import {
  buildCheckoutResumeUrl,
  buildDashboardUrl,
  persistPendingCheckoutContext,
  useAuthAction,
} from "@/hooks/use-auth-action";
import {
  clearPendingTranscriptionClaim,
  getAnonymousTranscriptionAccessToken,
  saveGuestTranscriptionClaimState,
} from "@/lib/transcriptions/client-storage";
import { toast } from "sonner";
import {
  toastConfirmOptions,
  toastErrorOptions,
} from "@markless/shared/src/lib/toast-options";
import { useTranscriptionShare } from "@/hooks/use-transcription-share";
import { apiFetch } from "@markless/shared/src/lib/http/client";
import { sanitizeLocalReturnTo } from "@markless/shared/src/lib/payments/client-checkout";
import type { ApiErrorResponse } from "@markless/shared/src/types/api/video";
import type { TranscriptionExportOptions } from "@/components/transcriptions/transcription-export-dialog";
import type { AppDictionary } from "@markless/shared/src/i18n/types";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";
import {
  trackTranscriptExport,
  trackTranscriptionGuestAuthClicked,
} from "@/lib/analytics/project";

type ExportErrorPayload = ApiErrorResponse | null;

type UserBootstrapSnapshot = {
  authenticated?: boolean;
};

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

function getFileNameFromContentDisposition(
  value: string | null,
  fallback: string
): string {
  if (!value) {
    return fallback;
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = value.match(/filename="?([^";]+)"?/i);
  if (asciiMatch?.[1]) {
    return asciiMatch[1];
  }

  return fallback;
}

function getCurrentTranscriptionPageUrl(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (
    sanitizeLocalReturnTo(
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    ) ?? undefined
  );
}

export type UseTranscriptionPageChromeOptions = {
  publicId: string;
  pageDict: TranscriptionsPageDictionary;
  dictionary: AppDictionary;
  locale: string;
  bootstrap?: UserBootstrapSnapshot | null;
  truncatedDurationLabel?: string;
  originalDurationLabel?: string;
  hasEditedSegments?: boolean;
};

export function useTranscriptionPageChrome({
  publicId,
  pageDict,
  dictionary,
  locale,
  bootstrap,
  truncatedDurationLabel,
  originalDurationLabel,
  hasEditedSegments = false,
}: UseTranscriptionPageChromeOptions) {
  const dashboardUrl = buildDashboardUrl(locale);
  const checkoutResumeUrl = buildCheckoutResumeUrl(locale);
  const exportDialogDict = pageDict.exportDialog;
  const pricingDict = dictionary.pages.pricing.subscriptionGrid;
  const unknownValue = pageDict.content.unknownValue;

  const { showAuthModal, authMode, openSignUp, closeAuth, setAuthMode } = useAuthAction();
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);
  const [isAppUpgradeDialogOpen, setIsAppUpgradeDialogOpen] = useState(false);
  const [appUpgradeEntrySurface, setAppUpgradeEntrySurface] = useState(
    "transcription_upgrade_card_view_all_plans"
  );
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isShareGateOpen, setIsShareGateOpen] = useState(false);
  const {
    isOpen: isShareDialogOpen,
    setIsOpen: setIsShareDialogOpen,
    isLoading: isShareDialogLoading,
    isMutating: isShareDialogMutating,
    share,
    openDialog: openShareDialog,
    enableShare: handleEnableShare,
    revokeShare: handleRevokeShare,
    copyShareLink: handleCopyShareLink,
  } = useTranscriptionShare({
    publicId,
    dict: pageDict.shareDialog,
    onError: (message) => {
      toast.error(message, toastErrorOptions);
    },
    onCopySuccess: (message) => {
      toast.success(message, toastConfirmOptions);
    },
  });

  const getTranscriptionAuthHeaders = useCallback((): Record<string, string> | undefined => {
    const accessToken = getAnonymousTranscriptionAccessToken(publicId);
    return accessToken
      ? {
          "x-transcription-access-token": accessToken,
        }
      : undefined;
  }, [publicId]);

  const preparePendingClaimForAuth = useCallback(() => {
    const accessToken = getAnonymousTranscriptionAccessToken(publicId);

    if (!accessToken) {
      clearPendingTranscriptionClaim();
      return;
    }

    saveGuestTranscriptionClaimState(publicId, accessToken);
  }, [publicId]);

  const handleGuestSignupAction = useCallback(() => {
    trackTranscriptionGuestAuthClicked({
      action: "save_transcript",
      dedupeKey: `transcription_guest_auth:${publicId}:save_transcript`,
    });
    preparePendingClaimForAuth();
    openSignUp("transcription_save", dashboardUrl);
  }, [dashboardUrl, openSignUp, preparePendingClaimForAuth, publicId]);

  const openShareGateFromGuest = useCallback(() => {
    setIsShareGateOpen(true);
  }, []);

  const handleShareGateSignUp = useCallback(() => {
    preparePendingClaimForAuth();
    setIsShareGateOpen(false);
    openSignUp("go_dashboard", getCurrentTranscriptionPageUrl());
  }, [openSignUp, preparePendingClaimForAuth]);

  const handleUpgradeRequireAuth = useCallback(
    (productId: string) => {
      setIsUpgradeDialogOpen(false);
      const currentLocation =
        typeof window !== "undefined"
          ? sanitizeLocalReturnTo(
              `${window.location.pathname}${window.location.search}${window.location.hash}`
            )
          : undefined;
      persistPendingCheckoutContext({
        productId,
        entrySurface: "transcription_upgrade_dialog",
        returnTo: currentLocation,
        locale,
        sourcePage: currentLocation,
      });
      openSignUp("resume_checkout", checkoutResumeUrl);
    },
    [checkoutResumeUrl, locale, openSignUp]
  );

  const openAppUpgradeDialog = useCallback((entrySurface: string) => {
    setAppUpgradeEntrySurface(entrySurface);
    setIsAppUpgradeDialogOpen(true);
  }, []);

  const handleViewAllPlansFromUpgradeCard = useCallback(() => {
    setIsUpgradeDialogOpen(false);
    openAppUpgradeDialog("transcription_upgrade_card_view_all_plans");
  }, [openAppUpgradeDialog]);

  const handleViewAllPlansFromUpgradeDialog = useCallback(() => {
    setIsUpgradeDialogOpen(false);
    openAppUpgradeDialog("transcription_upgrade_dialog_view_all_plans");
  }, [openAppUpgradeDialog]);

  const upgradePanelProps = useMemo(
    () => ({
      dict: pageDict.upgradePlanCard,
      planDict: pricingDict.plans.basic,
      priceLabels: pricingDict.price,
      annualSaveBadgeTemplate: pricingDict.billingToggle.annualSaveBadge,
      truncatedDurationLabel: truncatedDurationLabel ?? unknownValue,
      originalDurationLabel: originalDurationLabel ?? unknownValue,
      onRequireAuth: handleUpgradeRequireAuth,
      onViewAllPlans: handleViewAllPlansFromUpgradeDialog,
    }),
    [
      handleUpgradeRequireAuth,
      handleViewAllPlansFromUpgradeDialog,
      originalDurationLabel,
      pageDict.upgradePlanCard,
      pricingDict.billingToggle.annualSaveBadge,
      pricingDict.plans.basic,
      pricingDict.price,
      truncatedDurationLabel,
      unknownValue,
    ]
  );

  const handleExportDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isExporting) {
        return;
      }

      setIsExportDialogOpen(open);
    },
    [isExporting]
  );

  const handleExport = useCallback(
    async (options: TranscriptionExportOptions) => {
      setIsExporting(true);
      const dedupeKey = `transcript_export:${publicId}:${options.format}`;
      trackTranscriptExport({
        format: options.format,
        isAuthenticated: Boolean(bootstrap?.authenticated),
        source: "result",
        succeeded: false,
        dedupeKey: `${dedupeKey}:started`,
      });

      try {
        const response = await apiFetch(`/api/transcriptions/${publicId}/export`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(getTranscriptionAuthHeaders() ?? {}),
          },
          body: JSON.stringify(options),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as ExportErrorPayload;
          throw new Error(
            payload && !payload.success
              ? payload.error.message
              : exportDialogDict.exportError
          );
        }

        const blob = await response.blob();
        const fallbackFileName = `${publicId}-transcript.${options.format}`;
        const fileName = getFileNameFromContentDisposition(
          response.headers.get("content-disposition"),
          fallbackFileName
        );

        triggerBrowserDownload(blob, fileName);
        trackTranscriptExport({
          format: options.format,
          isAuthenticated: Boolean(bootstrap?.authenticated),
          source: "result",
          succeeded: true,
          dedupeKey: `${dedupeKey}:completed`,
        });
        setIsExportDialogOpen(false);
        toast.success(exportDialogDict.exportSuccess, toastConfirmOptions);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : exportDialogDict.exportError,
          toastErrorOptions
        );
      } finally {
        setIsExporting(false);
      }
    },
    [
      bootstrap?.authenticated,
      exportDialogDict.exportError,
      exportDialogDict.exportSuccess,
      getTranscriptionAuthHeaders,
      publicId,
    ]
  );

  const guestSidebarProps = useMemo(
    () => ({
      onSignupAction: handleGuestSignupAction,
    }),
    [handleGuestSignupAction]
  );

  const chromeDialogProps: TranscriptionPageChromeDialogsProps = {
    exportDialogDict,
    isExportDialogOpen,
    isExporting,
    onExportDialogOpenChange: handleExportDialogOpenChange,
    onExport: handleExport,
    hasEditedSegments,
    isUpgradeDialogOpen,
    onUpgradeDialogOpenChange: setIsUpgradeDialogOpen,
    upgradePanelProps,
    isAppUpgradeDialogOpen,
    onAppUpgradeDialogOpenChange: setIsAppUpgradeDialogOpen,
    appUpgradeEntrySurface,
    shareGateDict: pageDict.shareGate,
    isShareGateOpen,
    onShareGateOpenChange: setIsShareGateOpen,
    onShareGateSignUp: handleShareGateSignUp,
    shareDialogDict: pageDict.shareDialog,
    isShareDialogOpen,
    onShareDialogOpenChange: setIsShareDialogOpen,
    shareDialogEnabled: share?.enabled ?? false,
    shareDialogUrl: share?.shareUrl ?? null,
    isShareDialogLoading,
    isShareDialogMutating,
    onShareDialogEnable: async () => {
      await handleEnableShare();
    },
    onShareDialogDisable: async () => {
      await handleRevokeShare();
    },
    onShareDialogCopy: handleCopyShareLink,
    showAuthModal,
    onAuthModalOpenChange: closeAuth,
    authMode,
    onAuthModeChange: setAuthMode,
    locale,
    authModalDict: dictionary.tools.authModal,
  };

  return {
    guestSidebarProps,
    openExportDialog: () => setIsExportDialogOpen(true),
    openShareDialog,
    openShareGateFromGuest,
    openUpgradeDialog: () => setIsUpgradeDialogOpen(true),
    openAppUpgradeDialog: () =>
      openAppUpgradeDialog("transcription_upgrade_card_view_all_plans"),
    closeUpgradeDialog: () => setIsUpgradeDialogOpen(false),
    preparePendingClaimForAuth,
    handleViewAllPlansFromUpgradeCard,
    upgradePanelProps,
    chromeDialogProps,
  };
}
