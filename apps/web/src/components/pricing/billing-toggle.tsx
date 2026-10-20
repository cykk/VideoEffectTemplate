"use client";

import { cn } from "@markless/shared/src/lib/utils";
import type { PricingPeriod } from "@markless/shared/src/lib/pricing/i18n-config";

interface BillingToggleProps {
  period: PricingPeriod;
  onPeriodChange: (period: PricingPeriod) => void;
  annualDiscountPercent: number;
  labels: {
    oneTime: string;
    monthly: string;
    annual: string;
    annualSaveBadge: string;
  };
  className?: string;
}

const PERIODS: PricingPeriod[] = ["one-time", "monthly", "yearly"];

export function BillingToggle({
  period,
  onPeriodChange,
  annualDiscountPercent,
  labels,
  className,
}: BillingToggleProps) {
  const annualSaveLabel = labels.annualSaveBadge.replace(
    "{percent}",
    String(annualDiscountPercent)
  );

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="inline-flex items-center rounded-full bg-slate-100 p-1 shadow-sm">
        {PERIODS.map((value) => {
          const isSelected = period === value;
          const isAnnual = value === "yearly";

          const label =
            value === "one-time"
              ? labels.oneTime
              : value === "monthly"
                ? labels.monthly
                : labels.annual;

          return (
            <button
              key={value}
              type="button"
              onClick={() => onPeriodChange(value)}
              className={cn(
                "relative inline-flex cursor-pointer items-center justify-center rounded-full px-5 py-2 text-sm font-medium transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2",
                isSelected
                  ? "bg-white font-semibold text-primary shadow-sm"
                  : "text-slate-500 hover:bg-white/70 hover:text-slate-700"
              )}
            >
              <span>{label}</span>
              {isAnnual ? (
                <span
                  className={cn(
                    "ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    isSelected
                      ? "bg-brand-100 text-brand-700"
                      : "bg-slate-200/80 text-slate-500"
                  )}
                >
                  {annualSaveLabel}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
