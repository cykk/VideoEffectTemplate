"use client";

import { useCallback, useState } from "react";
import { AlertCircle, Check, Loader2, Sparkles, Zap } from "lucide-react";
import { cn } from "@markless/shared/src/lib/utils";
import {
  formatUsdPrice,
  getCheckoutProductId,
  getDisplayPricingValues,
  getRepresentativeAnnualDiscountPercent,
} from "@markless/shared/src/lib/pricing/display-plans";
import { Button } from "@/components/ui/button";
import { renderHighlightedTemplate } from "@/lib/transcriptions/render-highlighted-template";
import { usePayment } from "@/hooks/use-payment";
import { useUserBootstrap } from "@/hooks/use-user-bootstrap";
import { trackTranscriptionSubscriptionClicked } from "@/lib/analytics/project";
import type {
  PricingPageDictionary,
  TranscriptionsPageDictionary,
} from "@markless/shared/src/i18n/types";

export type TranscriptionBasicUpgradeHeaderVariant =
  | "truncated"
  | "upgrade"
  | "planOnly";

type BillingPeriod = "yearly" | "monthly";

const TRUNCATION_HIGHLIGHT_CLASSNAME = "font-normal text-slate-500";

export interface TranscriptionBasicUpgradePanelProps {
  headerVariant: TranscriptionBasicUpgradeHeaderVariant;
  dict: TranscriptionsPageDictionary["upgradePlanCard"];
  planDict: PricingPageDictionary["subscriptionGrid"]["plans"]["basic"];
  priceLabels: PricingPageDictionary["subscriptionGrid"]["price"];
  annualSaveBadgeTemplate: string;
  truncatedDurationLabel: string;
  originalDurationLabel?: string;
  onRequireAuth: (productId: string) => void;
  onViewAllPlans?: () => void;
  entrySurface: string;
  featuresLayout?: "single" | "grid";
  className?: string;
}

export function TranscriptionBasicUpgradePanel({
  headerVariant,
  dict,
  planDict,
  priceLabels,
  annualSaveBadgeTemplate,
  truncatedDurationLabel,
  originalDurationLabel,
  onRequireAuth,
  onViewAllPlans,
  entrySurface,
  featuresLayout = "grid",
  className,
}: TranscriptionBasicUpgradePanelProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>("yearly");
  const { createCheckout, isLoading: isCheckoutLoading } = usePayment();
  const { data: bootstrap, loading: bootstrapLoading } = useUserBootstrap();
  const isAuthenticated = !!bootstrap?.authenticated;
  const annualDiscountPercent = getRepresentativeAnnualDiscountPercent();

  const yearlyPricing = getDisplayPricingValues("tier1", "yearly", priceLabels);
  const monthlyPricing = getDisplayPricingValues("tier1", "monthly", priceLabels);

  const saveBadgeLabel = annualSaveBadgeTemplate.replace(
    "{percent}",
    String(annualDiscountPercent)
  );

  const handleSubscribe = useCallback(async () => {
    if (bootstrapLoading || isCheckoutLoading) {
      return;
    }

    const productId = getCheckoutProductId("tier1", selectedPeriod);
    if (!productId) {
      return;
    }

    trackTranscriptionSubscriptionClicked({
      entrySurface,
      billingPeriod: selectedPeriod,
      productId,
      isAuthenticated,
    });

    if (!isAuthenticated) {
      onRequireAuth(productId);
      return;
    }

    await createCheckout(productId, { entrySurface });
  }, [
    bootstrapLoading,
    createCheckout,
    entrySurface,
    isAuthenticated,
    isCheckoutLoading,
    onRequireAuth,
    selectedPeriod,
  ]);

  const billingOptions: Array<{
    period: BillingPeriod;
    label: string;
    pricing: NonNullable<ReturnType<typeof getDisplayPricingValues>>;
    note: string;
    saveBadge?: string;
  }> = [];

  if (yearlyPricing) {
    billingOptions.push({
      period: "yearly",
      label: dict.billing.yearlyLabel,
      pricing: yearlyPricing,
      note: yearlyPricing.billingNote ?? "",
      saveBadge: saveBadgeLabel,
    });
  }

  if (monthlyPricing) {
    billingOptions.push({
      period: "monthly",
      label: dict.billing.monthlyLabel,
      pricing: monthlyPricing,
      note: dict.billing.cancelAnytime,
    });
  }

  const isPlanOnlyHeader = headerVariant === "planOnly";
  const isTruncatedHeader = headerVariant === "truncated";

  return (
    <div className={cn("space-y-6 bg-white p-6 sm:p-8", className)}>
      {!isPlanOnlyHeader ? (
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
            {isTruncatedHeader ? (
              <AlertCircle className="size-7" aria-hidden="true" />
            ) : (
              <Sparkles className="size-7" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {isTruncatedHeader ? dict.limitReached.title : dict.upgrade.title}
            </h3>
            {isTruncatedHeader ? (
              <div className="space-y-1">
                <p className="text-sm leading-relaxed text-slate-500 sm:text-base">
                  {renderHighlightedTemplate(
                    dict.limitReached.previewLine,
                    { truncated: truncatedDurationLabel },
                    TRUNCATION_HIGHLIGHT_CLASSNAME
                  )}
                </p>
                <p className="text-sm leading-relaxed text-slate-500 sm:text-base">
                  {renderHighlightedTemplate(
                    dict.limitReached.unlockLine,
                    { original: originalDurationLabel ?? "" },
                    TRUNCATION_HIGHLIGHT_CLASSNAME
                  )}
                </p>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-slate-500 sm:text-base">
                {dict.upgrade.description}
              </p>
            )}
          </div>
        </div>
      ) : null}

      <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/80 p-5">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            <Zap className="size-3" aria-hidden="true" />
            {dict.plan.badge}
          </span>
          <h4 className="text-lg font-bold text-slate-900">{dict.plan.title}</h4>
        </div>

        <ul
          className={cn(
            "grid grid-cols-1 gap-2.5",
            featuresLayout === "grid" && "lg:grid-cols-2 lg:gap-x-6"
          )}
        >
          {dict.plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-600">
              <Check
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3" role="radiogroup" aria-label={dict.billing.groupAria}>
        {billingOptions.map((option) => {
          const isSelected = selectedPeriod === option.period;

          return (
            <button
              key={option.period}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelectedPeriod(option.period)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-200",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
              )}
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                  isSelected ? "border-primary" : "border-slate-300"
                )}
                aria-hidden="true"
              >
                {isSelected ? (
                  <span className="size-2 rounded-full bg-primary" />
                ) : null}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-[10px] font-bold uppercase tracking-wide",
                    isSelected ? "text-primary" : "text-slate-400"
                  )}
                >
                  {option.label}
                </span>
                <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-2xl font-bold text-slate-900">
                    {formatUsdPrice(option.pricing.amount)}
                  </span>
                  <span className="text-sm font-medium text-slate-500">
                    {option.pricing.periodSuffix}
                  </span>
                </span>
                {option.note ? (
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {option.note}
                  </span>
                ) : null}
              </span>

              {option.saveBadge ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  <Sparkles className="size-3" aria-hidden="true" />
                  {option.saveBadge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          className="h-11 w-full rounded-lg bg-primary text-sm font-semibold text-white hover:bg-primary/90"
          disabled={isCheckoutLoading || bootstrapLoading}
          onClick={() => {
            void handleSubscribe();
          }}
        >
          {isCheckoutLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              {dict.cta.processing}
            </>
          ) : (
            planDict.cta
          )}
        </Button>

        <div className="space-y-2 text-center">
          {onViewAllPlans ? (
            <button
              type="button"
              className="w-full cursor-pointer text-sm font-medium text-slate-600 transition-colors hover:text-primary hover:underline"
              onClick={onViewAllPlans}
            >
              {dict.cta.viewAllPlans}
            </button>
          ) : null}
          <p className="text-xs font-normal text-slate-500">
            {dict.cta.subscriptionReassurance}
          </p>
        </div>
      </div>
    </div>
  );
}
