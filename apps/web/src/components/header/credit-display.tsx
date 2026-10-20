"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { getDictionary } from "@markless/shared/src/i18n";
import type { Locale } from "@markless/shared/src/i18n/types";
import { cn } from "@markless/shared/src/lib/utils";
import { AppUpgradeDialog } from "@/components/pricing/app-upgrade-dialog";
import { formatAppNumber } from "@/lib/formatters";

interface CreditDisplayProps {
  credits?: number;
  plan?: string;
  locale: Locale;
  lowThreshold?: number;
  subscriptionInfo?: unknown;
  mode?: "marketing" | "app";
}

export function CreditDisplay({
  credits,
  locale,
  mode = "app",
}: CreditDisplayProps) {
  const dictionary = getDictionary(locale);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const resolvedCredits = credits ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => mode === "app" && setIsPricingModalOpen(true)}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-neutral-600 transition-all duration-300 group dark:text-neutral-300",
          mode === "app" ? "cursor-pointer" : "cursor-default"
        )}
        title={
          mode === "app"
            ? dictionary.pages.membership.page.header.manageCreditsTitle
            : undefined
        }
      >
        <Zap
          className={cn(
            "h-4 w-4 fill-brand-500/10 text-brand-500 transition-all dark:fill-brand-400/10 dark:text-brand-400",
            mode === "app" && "group-hover:scale-110"
          )}
        />
        <span
          className={cn(
            "text-sm font-semibold tabular-nums text-brand-600 transition-colors dark:text-brand-400",
            mode === "app" && "group-hover:text-brand-500 dark:group-hover:text-brand-300"
          )}
        >
          {formatAppNumber(resolvedCredits, locale)}
        </span>
      </button>

      {mode === "app" ? (
        <AppUpgradeDialog
          open={isPricingModalOpen}
          onOpenChange={setIsPricingModalOpen}
          entrySurface="header_credit_badge"
        />
      ) : null}
    </>
  );
}
