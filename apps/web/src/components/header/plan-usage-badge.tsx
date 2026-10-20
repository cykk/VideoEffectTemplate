"use client";

import { useState } from "react";
import { ChevronDown, Sparkles, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  buildCreditsBadgeLabel,
  buildSubscriptionBadgeLabel,
  PlanUsagePopoverContent,
} from "@/components/header/plan-usage-popover-content";
import { AppUpgradeDialog } from "@/components/pricing/app-upgrade-dialog";
import { USER_BOOTSTRAP_QUERY_KEY } from "@/hooks/use-user-bootstrap";
import { cn } from "@markless/shared/src/lib/utils";
import type { HeaderDictionary, Locale } from "@markless/shared/src/i18n/types";
import type { UserEntitlements } from "@markless/shared/src/types/user-entitlements";

type PlanUsageBadgeProps = {
  entitlements: UserEntitlements | null;
  loading?: boolean;
  locale: Locale;
  dictionary: HeaderDictionary["planUsage"];
};

function resolveBadgeLabel(
  entitlements: UserEntitlements | null,
  dictionary: HeaderDictionary["planUsage"],
  locale: Locale
): string {
  if (!entitlements) {
    return dictionary.free.badgeLabel;
  }

  if (entitlements.billingMode === "subscription") {
    return buildSubscriptionBadgeLabel(entitlements, dictionary);
  }

  if (entitlements.billingMode === "credits") {
    return buildCreditsBadgeLabel(entitlements, dictionary, locale);
  }

  return dictionary.free.badgeLabel;
}

export function PlanUsageBadge({
  entitlements,
  loading = false,
  locale,
  dictionary,
}: PlanUsageBadgeProps) {
  const queryClient = useQueryClient();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const badgeLabel = resolveBadgeLabel(entitlements, dictionary, locale);
  const isPaid =
    entitlements?.billingMode === "subscription" ||
    entitlements?.billingMode === "credits";

  const handlePopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (open) {
      void queryClient.invalidateQueries({ queryKey: USER_BOOTSTRAP_QUERY_KEY, exact: true });
    }
  };

  const handleUpgrade = () => {
    setPopoverOpen(false);
    setUpgradeOpen(true);
  };

  if (loading) {
    return <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />;
  }

  if (!entitlements) {
    return null;
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={dictionary.badgeAria}
            className={cn(
              "group inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition-all",
              isPaid
                ? "border-brand-200 bg-brand-50/50 text-brand-700 hover:bg-brand-50 hover:shadow"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:shadow"
            )}
          >
            {isPaid ? (
              <Sparkles className="size-3.5 text-brand-500" aria-hidden="true" />
            ) : (
              <Zap className="size-3.5 text-slate-400" aria-hidden="true" />
            )}
            <span>{badgeLabel}</span>
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 transition-transform duration-200 group-hover:translate-y-[1px]",
                isPaid ? "text-brand-500/70" : "text-slate-400"
              )}
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[300px] overflow-visible p-4">
          <PlanUsagePopoverContent
            entitlements={entitlements}
            dictionary={dictionary}
            locale={locale}
            onUpgrade={handleUpgrade}
          />
        </PopoverContent>
      </Popover>

      <AppUpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        entrySurface="header_plan_usage_badge"
      />
    </>
  );
}
