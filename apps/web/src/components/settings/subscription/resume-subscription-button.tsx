"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { resumeUserSubscriptionRequest } from "@/lib/user/subscription-client";
import { Loader2, ArrowRight } from "lucide-react";
import type { CancelSubscriptionModalDictionary, Locale } from "@markless/shared/src/i18n/types";
import { getPricingCopy } from "@markless/shared/src/i18n/components/pricing";
import { useLocale } from "@/hooks/use-locale";

interface ResumeSubscriptionButtonProps {
  locale: Locale;
  variant?: "alert" | "footer";
}

type SubscriptionActionErrors = CancelSubscriptionModalDictionary["errors"];

const EMPTY_SUBSCRIPTION_ACTION_ERRORS: SubscriptionActionErrors = {
  cancelFailed: "",
  resumeFailed: "",
  unexpectedError: "",
  noActiveSubscription: "",
  noScheduledCancellation: "",
  providerCancellationFailed: "",
  resumeRequiresScheduledCancellation: "",
  resumeExpiredSubscription: "",
  productInfoNotFound: "",
  previewNotImplemented: "",
  unsupportedProvider: "",
  internalPreviewError: "",
  upgradeRejected: "",
};

export function ResumeSubscriptionButton({ locale, variant = "alert" }: ResumeSubscriptionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const t = useMemo(() => getPricingCopy(locale), [locale]);
  const { dictionary } = useLocale();
  const SettingsErrors = dictionary?.pages?.membership?.cancelSubscriptionModal?.errors;

  const handleResume = async () => {
    setIsLoading(true);
    try {
      const result = await resumeUserSubscriptionRequest(
        SettingsErrors ?? EMPTY_SUBSCRIPTION_ACTION_ERRORS,
      );
      if (result.success) {
        window.location.reload();
      } else {
        alert(result.error || SettingsErrors?.resumeFailed || "");
      }
    } catch {
      alert(SettingsErrors?.unexpectedError || "");
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === "alert") {
    return (
      <Button 
        onClick={handleResume}
        disabled={isLoading}
        className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md cursor-pointer"
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t.subscriptionManagement.resumeSubscription}
      </Button>
    );
  }

  return (
    <Button 
      onClick={handleResume}
      disabled={isLoading}
      className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md cursor-pointer"
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : null}
      {t.subscriptionManagement.resumeSubscription} <ArrowRight className="w-4 h-4 ml-1" />
    </Button>
  );
}

